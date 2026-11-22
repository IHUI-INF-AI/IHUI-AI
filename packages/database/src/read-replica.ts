// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { performance } from 'node:perf_hooks'
import * as schema from './schema/index.js'
import { buildPoolOptions } from './pool-options.js'

/**
 * SQL 查询日志事件。
 *
 * 注意:drizzle-orm 0.38 的 Logger.logQuery 仅在查询执行**前**调用,
 * 只提供 query/params,不提供 durationMs。因此改用 monkey-patch
 * postgres-js client 的 unsafe 方法,用 performance.now() 测量真实耗时。
 */
export interface SqlLogEvent {
  query: string
  params: unknown[]
  /** 查询耗时(毫秒),由 unsafe 包装器用 performance.now() 测量 */
  durationMs: number
  timestamp: number
}

/** SQL 日志回调类型。 */
export type SqlLoggerFn = (event: SqlLogEvent) => void

export interface DatabaseConfig {
  url: string
  /** 单读副本 URL（向后兼容；有 replicas 时忽略此项） */
  readReplicaUrl?: string
  /** 多读副本列表（含优先级，用于故障转移） */
  replicas?: ReplicaConfig[]
  max?: number
  idleTimeoutMillis?: number
  /** 连接排队等待上限（秒），默认 5。 */
  connectTimeoutSec?: number
  /** 连接最大存活时长（秒），默认 30 分钟。 */
  maxLifetimeSec?: number
  /** 单条语句超时（毫秒），默认 30s / DB_STATEMENT_TIMEOUT_MS。 */
  statementTimeoutMs?: number
  /**
   * SQL 查询日志回调。设置后,主库与所有读副本的每次查询都会回调,
   * 携带 query/params/durationMs/timestamp。
   * 用于驱动 slow-sql-killer 与 n1-detector 等监控插件。
   */
  logger?: SqlLoggerFn
}

/** 读副本配置（含优先级，用于故障转移选举）。 */
export interface ReplicaConfig {
  /** 节点 ID（唯一标识） */
  id: string
  /** PostgreSQL 连接 URL */
  url: string
  /** 选举优先级（数值越大越优先） */
  priority: number
}

/** 读副本运行时健康状态。 */
export interface ReplicaStatus {
  id: string
  priority: number
  healthy: boolean
  lagSec: number
  failCount: number
}

/** 连续失败多少次后标记为不健康。 */
const FAIL_THRESHOLD = 3
/** 最大允许复制延迟（秒），超过则标记不健康。 */
const MAX_LAG_SEC = 10

/**
 * DB-27:把副本上报的 WAL 回放时延(毫秒)规整为秒。
 *
 * - null/undefined/非有限值 ⇒ undefined(调用方保留上次读数,不得抹成 0);
 * - 负值(两机时钟倒挂)⇒ 0,不产生负延迟;
 * - 其余 ⇒ 毫秒 / 1000。
 */
export function normalizeReplicaLagSec(lagMs: number | null | undefined): number | undefined {
  if (lagMs === null || lagMs === undefined) return undefined
  if (!Number.isFinite(lagMs)) return undefined
  if (lagMs < 0) return 0
  return lagMs / 1000
}

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
 *
 * O13 补齐(2026-09-21):导出给 apps/api 的受控出口独立池(DATABASE_APP_URL)复用,
 * 口径与主池/读副本完全一致 —— scoped 池的 SQL 同样进 sqlEventBus,不另发明事件。
 */
export function wrapClientWithLogger(client: postgres.Sql, logger: SqlLoggerFn): postgres.Sql {
  // 提前 bind,避免 wrapper 中使用 this(严格模式下 this 需显式标注)
  const originalUnsafe = client.unsafe.bind(client)
  // monkey-patch unsafe:保持原签名,仅在完成时测量耗时
  const wrappedUnsafe = (query: string, params?: unknown[], options?: unknown) => {
    const start = performance.now()
    const pending = originalUnsafe(
      query,
      params as Parameters<typeof originalUnsafe>[1],
      options as Parameters<typeof originalUnsafe>[2],
    )
    // PendingQuery extends Promise,附加 then 监听器测量耗时(不消费/不改变 pending)
    if (pending && typeof (pending as Promise<unknown>).then === 'function') {
      ;(pending as Promise<unknown>).then(
        () => {
          logger({
            query,
            params: params ?? [],
            durationMs: performance.now() - start,
            timestamp: Date.now(),
          })
        },
        () => {
          // 查询失败也记录耗时(便于排查慢查询导致的超时)
          logger({
            query,
            params: params ?? [],
            durationMs: performance.now() - start,
            timestamp: Date.now(),
          })
        },
      )
    }
    return pending
  }
  ;(client as unknown as { unsafe: postgres.Sql['unsafe'] }).unsafe =
    wrappedUnsafe as postgres.Sql['unsafe']
  return client
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
export function createReadWriteDb(config: DatabaseConfig) {
  // DB-29/DB-31:主库与副本池走同一套护栏(statement/connect/idle/max_lifetime),
  // max 由 config.max 或 DB_POOL_MAX 决定(默认 40)。
  const poolOptions = buildPoolOptions({
    max: config.max,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectTimeoutSec: config.connectTimeoutSec,
    maxLifetimeSec: config.maxLifetimeSec,
    statementTimeoutMs: config.statementTimeoutMs,
  })

  const writerClient = config.logger
    ? wrapClientWithLogger(postgres(config.url, poolOptions), config.logger)
    : postgres(config.url, poolOptions)
  const dbWriter = drizzle(writerClient, { schema })
  type Db = typeof dbWriter

  // 构建读副本列表：优先使用 replicas，否则回退到单个 readReplicaUrl
  const replicaConfigs: ReplicaConfig[] =
    config.replicas ??
    (config.readReplicaUrl ? [{ id: 'default', url: config.readReplicaUrl, priority: 100 }] : [])

  // 为每个副本创建客户端与 drizzle 实例
  const replicaClients = new Map<string, postgres.Sql>()
  const replicaDbs = new Map<string, Db>()
  const replicaHealth = new Map<string, ReplicaStatus>()

  for (const r of replicaConfigs) {
    const client = config.logger
      ? wrapClientWithLogger(postgres(r.url, poolOptions), config.logger)
      : postgres(r.url, poolOptions)
    const db = drizzle(client, { schema })
    replicaClients.set(r.id, client)
    replicaDbs.set(r.id, db)
    replicaHealth.set(r.id, {
      id: r.id,
      priority: r.priority,
      // DB-28:初值 false —— 首轮探测成功前 getReader() 回退主库,
      // 不让"进程刚启动/副本 TCP 不可达"的 30–45s 窗口把读接口打成 5xx。
      healthy: false,
      lagSec: 0,
      failCount: 0,
    })
  }

  /**
   * 选举当前最优健康读副本的 ID（无健康副本时返回 null ⇒ 回退主库）。
   * 优先返回优先级最高且健康的副本。
   */
  function pickBestReplicaId(): string | null {
    let bestId: string | null = null
    let bestPriority = -1
    for (const [id, status] of replicaHealth) {
      if (status.healthy && status.priority > bestPriority) {
        bestPriority = status.priority
        bestId = id
      }
    }
    return bestId
  }

  /**
   * 获取当前最优健康读副本的 drizzle 实例。
   * 全部不健康时回退到主库。
   */
  function getReader(): Db {
    const bestId = pickBestReplicaId()
    return bestId !== null ? (replicaDbs.get(bestId) ?? dbWriter) : dbWriter
  }

  /** 获取当前最优健康读副本的 postgres 客户端（全部不健康时回退主库客户端）。 */
  function getReaderClient(): postgres.Sql {
    const bestId = pickBestReplicaId()
    return bestId !== null ? (replicaClients.get(bestId) ?? writerClient) : writerClient
  }

  /**
   * 上报读副本健康状态（驱动故障转移）。
   *
   * 连续失败达 FAIL_THRESHOLD 后标记为不健康，getReader() 将跳过该副本。
   * 成功时减少失败计数，归零后恢复健康。
   */
  /**
   * lagSec 可选:监控只按"成功/失败"上报(不传延迟)时保留上次读数,绝不把真实延迟
   * 抹成 0 —— 否则一次成功上报就会让"因延迟过大判不健康"的慢副本被 getReader()
   * 重新选回来(BUG-32)。健康判据不得被 ok 覆盖:恢复健康须同时满足延迟未超阈值。
   */
  function reportReplicaHealth(replicaId: string, ok: boolean, lagSec?: number): void {
    const status = replicaHealth.get(replicaId)
    if (!status) return
    if (lagSec !== undefined) status.lagSec = lagSec
    const effectiveLagSec = status.lagSec
    if (ok) {
      status.failCount = Math.max(0, status.failCount - 1)
      if (status.failCount === 0 && effectiveLagSec <= MAX_LAG_SEC) status.healthy = true
    } else {
      status.failCount++
      if (status.failCount >= FAIL_THRESHOLD) status.healthy = false
    }
    // 复制延迟过大始终标记不健康(含"本次未提供 lagSec,但保留读数已超阈值"的情形)
    if (effectiveLagSec > MAX_LAG_SEC) status.healthy = false
  }

  /** 获取所有读副本状态快照。 */
  function getReplicaStatuses(): ReplicaStatus[] {
    return Array.from(replicaHealth.values()).map((s) => ({ ...s }))
  }

  /**
   * DB-30:关闭主池与全部副本池，供进程优雅停机/测试收尾使用。
   *
   * 幂等（重复调用只 end 一次）；end() 默认等待在途查询完成，timeout 只约束
   * "等待多久后放弃"，不截断正在执行的语句。单个池关闭失败不影响其余池。
   */
  let closed = false
  async function close(): Promise<void> {
    if (closed) return
    closed = true
    const targets = [writerClient, ...Array.from(replicaClients.values())]
    await Promise.allSettled(targets.map((client) => client.end({ timeout: 5 })))
  }

  return {
    /** 主库 drizzle 实例（写） */
    dbWriter,
    /**
     * 默认读 drizzle 实例（向后兼容）。
     * DB-42:getter 每次按健康状态选举 —— 不再固定为「第一个副本」，
     * 副本失效后无需调用方改调 getReader() 也能自动转移。
     */
    get dbReader(): Db {
      return getReader()
    },
    /** 主库 postgres 客户端 */
    writerClient,
    /** 默认读 postgres 客户端（同 dbReader，按健康状态动态选举） */
    get readerClient(): postgres.Sql {
      return getReaderClient()
    },
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
    /** 关闭主池 + 全部副本池（幂等，优雅停机用） */
    close,
  }
}

export type ReadWriteDb = ReturnType<typeof createReadWriteDb>
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
