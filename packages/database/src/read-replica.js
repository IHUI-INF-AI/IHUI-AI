import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { performance } from 'node:perf_hooks';
import * as schema from './schema/index.js';
/** 连续失败多少次后标记为不健康。 */
const FAIL_THRESHOLD = 3;
/** 最大允许复制延迟（秒），超过则标记不健康。 */
const MAX_LAG_SEC = 10;
/**
 * 包装 postgres-js client 的 unsafe 方法,测量每次查询耗时并回调 logger。
 *
 * 为什么不用 drizzle 的 logger 配置:
 * drizzle-orm 0.38 的 Logger.logQuery 在查询执行**前**同步调用(session.js),
 * 只提供 query/params,不提供 durationMs,无法满足 slow-sql-killer 的耗时判断。
 * postgres-js 的 debug 选项同样是查询前回调,也不提供耗时。
 * 因此 monkey-patch unsafe(PendingQuery 是 thenable),在 resolve/reject 时计算耗时。
 *
 * 安全性:仅附加 .then 监听器,不改变返回的 PendingQuery 对象本身,
 * drizzle 内部调用的 .values()/.raw() 等方法不受影响。
 */
function wrapClientWithLogger(client, logger) {
    // 提前 bind,避免 wrapper 中使用 this(严格模式下 this 需显式标注)
    const originalUnsafe = client.unsafe.bind(client);
    // monkey-patch unsafe:保持原签名,仅在完成时测量耗时
    const wrappedUnsafe = (query, params, options) => {
        const start = performance.now();
        const pending = originalUnsafe(query, params, options);
        // PendingQuery extends Promise,附加 then 监听器测量耗时(不消费/不改变 pending)
        if (pending && typeof pending.then === 'function') {
            ;
            pending.then(() => {
                logger({ query, params: params ?? [], durationMs: performance.now() - start, timestamp: Date.now() });
            }, () => {
                // 查询失败也记录耗时(便于排查慢查询导致的超时)
                logger({ query, params: params ?? [], durationMs: performance.now() - start, timestamp: Date.now() });
            });
        }
        return pending;
    };
    client.unsafe =
        wrappedUnsafe;
    return client;
}
/**
 * 创建读写分离的数据库实例（含故障转移）。
 *
 * - 无 replicas 且无 readReplicaUrl 时，读写均走主库。
 * - 有 readReplicaUrl 时，读走单副本（向后兼容）。
 * - 有 replicas 时，支持多副本 + 健康探测 + 故障转移，
 *   getReader() 自动返回优先级最高的健康副本。
 *
 * 故障转移逻辑参考 bug170 FailoverManager：
 * 连续失败达阈值 → 标记不健康 → 选举优先级最高的健康从库。
 */
export function createReadWriteDb(config) {
    const poolOptions = {
        max: config.max ?? 20,
        idle_timeout: config.idleTimeoutMillis ?? 30_000,
        prepare: false,
    };
    const writerClient = config.logger
        ? wrapClientWithLogger(postgres(config.url, poolOptions), config.logger)
        : postgres(config.url, poolOptions);
    const dbWriter = drizzle(writerClient, { schema });
    // 构建读副本列表：优先使用 replicas，否则回退到单个 readReplicaUrl
    const replicaConfigs = config.replicas ??
        (config.readReplicaUrl ? [{ id: 'default', url: config.readReplicaUrl, priority: 100 }] : []);
    // 为每个副本创建客户端与 drizzle 实例
    const replicaClients = new Map();
    const replicaDbs = new Map();
    const replicaHealth = new Map();
    for (const r of replicaConfigs) {
        const client = config.logger
            ? wrapClientWithLogger(postgres(r.url, poolOptions), config.logger)
            : postgres(r.url, poolOptions);
        const db = drizzle(client, { schema });
        replicaClients.set(r.id, client);
        replicaDbs.set(r.id, db);
        replicaHealth.set(r.id, {
            id: r.id,
            priority: r.priority,
            healthy: true,
            lagSec: 0,
            failCount: 0,
        });
    }
    // 默认 reader：第一个副本（向后兼容），无副本时回退到主库
    const firstReplicaId = replicaConfigs[0]?.id;
    const readerClient = firstReplicaId
        ? (replicaClients.get(firstReplicaId) ?? writerClient)
        : writerClient;
    const dbReader = firstReplicaId ? (replicaDbs.get(firstReplicaId) ?? dbWriter) : dbWriter;
    /**
     * 获取当前最优健康读副本的 drizzle 实例。
     * 优先返回优先级最高且健康的副本；全部不健康时回退到主库。
     */
    function getReader() {
        let bestId = null;
        let bestPriority = -1;
        for (const [id, status] of replicaHealth) {
            if (status.healthy && status.priority > bestPriority) {
                bestPriority = status.priority;
                bestId = id;
            }
        }
        if (bestId !== null) {
            return replicaDbs.get(bestId) ?? dbWriter;
        }
        return dbWriter;
    }
    /**
     * 上报读副本健康状态（驱动故障转移）。
     *
     * 连续失败达 FAIL_THRESHOLD 后标记为不健康，getReader() 将跳过该副本。
     * 成功时减少失败计数，归零后恢复健康。
     */
    function reportReplicaHealth(replicaId, ok, lagSec = 0) {
        const status = replicaHealth.get(replicaId);
        if (!status)
            return;
        status.lagSec = lagSec;
        if (ok) {
            status.failCount = Math.max(0, status.failCount - 1);
            if (status.failCount === 0)
                status.healthy = true;
        }
        else {
            status.failCount++;
            if (status.failCount >= FAIL_THRESHOLD)
                status.healthy = false;
        }
        // 复制延迟过大也标记不健康
        if (lagSec > MAX_LAG_SEC)
            status.healthy = false;
    }
    /** 获取所有读副本状态快照。 */
    function getReplicaStatuses() {
        return Array.from(replicaHealth.values()).map((s) => ({ ...s }));
    }
    return {
        /** 主库 drizzle 实例（写） */
        dbWriter,
        /** 默认读副本 drizzle 实例（向后兼容；如需故障转移请用 getReader()） */
        dbReader,
        /** 主库 postgres 客户端 */
        writerClient,
        /** 默认读副本 postgres 客户端 */
        readerClient,
        /** 多副本 postgres 客户端（按 ID 索引） */
        replicaClients,
        /** 多副本 drizzle 实例（按 ID 索引） */
        replicaDbs,
        /** 获取当前最优健康读副本（故障转移核心方法） */
        getReader,
        /** 上报副本健康状态（驱动故障转移） */
        reportReplicaHealth,
        /** 获取所有副本状态 */
        getReplicaStatuses,
    };
}
//# sourceMappingURL=read-replica.js.map