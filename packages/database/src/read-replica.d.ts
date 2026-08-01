import postgres from 'postgres';
import * as schema from './schema/index.js';
/**
 * SQL 查询日志事件。
 *
 * 注意:drizzle-orm 0.38 的 Logger.logQuery 仅在查询执行**前**调用,
 * 只提供 query/params,不提供 durationMs。因此改用 monkey-patch
 * postgres-js client 的 unsafe 方法,用 performance.now() 测量真实耗时。
 */
export interface SqlLogEvent {
    query: string;
    params: unknown[];
    /** 查询耗时(毫秒),由 unsafe 包装器用 performance.now() 测量 */
    durationMs: number;
    timestamp: number;
}
/** SQL 日志回调类型。 */
export type SqlLoggerFn = (event: SqlLogEvent) => void;
export interface DatabaseConfig {
    url: string;
    /** 单读副本 URL（向后兼容；有 replicas 时忽略此项） */
    readReplicaUrl?: string;
    /** 多读副本列表（含优先级，用于故障转移） */
    replicas?: ReplicaConfig[];
    max?: number;
    idleTimeoutMillis?: number;
    /**
     * SQL 查询日志回调。设置后,主库与所有读副本的每次查询都会回调,
     * 携带 query/params/durationMs/timestamp。
     * 用于驱动 slow-sql-killer 与 n1-detector 等监控插件。
     */
    logger?: SqlLoggerFn;
}
/** 读副本配置（含优先级，用于故障转移选举）。 */
export interface ReplicaConfig {
    /** 节点 ID（唯一标识） */
    id: string;
    /** PostgreSQL 连接 URL */
    url: string;
    /** 选举优先级（数值越大越优先） */
    priority: number;
}
/** 读副本运行时健康状态。 */
export interface ReplicaStatus {
    id: string;
    priority: number;
    healthy: boolean;
    lagSec: number;
    failCount: number;
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
export declare function createReadWriteDb(config: DatabaseConfig): {
    /** 主库 drizzle 实例（写） */
    dbWriter: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
        $client: postgres.Sql<{}>;
    };
    /** 默认读副本 drizzle 实例（向后兼容；如需故障转移请用 getReader()） */
    dbReader: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
        $client: postgres.Sql<{}>;
    };
    /** 主库 postgres 客户端 */
    writerClient: postgres.Sql<{}>;
    /** 默认读副本 postgres 客户端 */
    readerClient: postgres.Sql<{}>;
    /** 多副本 postgres 客户端（按 ID 索引） */
    replicaClients: Map<string, postgres.Sql<{}>>;
    /** 多副本 drizzle 实例（按 ID 索引） */
    replicaDbs: Map<string, import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
        $client: postgres.Sql<{}>;
    }>;
    /** 获取当前最优健康读副本（故障转移核心方法） */
    getReader: () => import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
        $client: postgres.Sql<{}>;
    };
    /** 上报副本健康状态（驱动故障转移） */
    reportReplicaHealth: (replicaId: string, ok: boolean, lagSec?: number) => void;
    /** 获取所有副本状态 */
    getReplicaStatuses: () => ReplicaStatus[];
};
export type ReadWriteDb = ReturnType<typeof createReadWriteDb>;
