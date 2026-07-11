import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

export interface DatabaseConfig {
  url: string
  /** 单读副本 URL（向后兼容；有 replicas 时忽略此项） */
  readReplicaUrl?: string
  /** 多读副本列表（含优先级，用于故障转移） */
  replicas?: ReplicaConfig[]
  max?: number
  idleTimeoutMillis?: number
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
  const poolOptions = {
    max: config.max ?? 20,
    idle_timeout: config.idleTimeoutMillis ?? 30_000,
    prepare: false,
  }

  const writerClient = postgres(config.url, poolOptions)
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
    const client = postgres(r.url, poolOptions)
    const db = drizzle(client, { schema })
    replicaClients.set(r.id, client)
    replicaDbs.set(r.id, db)
    replicaHealth.set(r.id, {
      id: r.id,
      priority: r.priority,
      healthy: true,
      lagSec: 0,
      failCount: 0,
    })
  }

  // 默认 reader：第一个副本（向后兼容），无副本时回退到主库
  const firstReplicaId = replicaConfigs[0]?.id
  const readerClient = firstReplicaId
    ? (replicaClients.get(firstReplicaId) ?? writerClient)
    : writerClient
  const dbReader = firstReplicaId ? (replicaDbs.get(firstReplicaId) ?? dbWriter) : dbWriter

  /**
   * 获取当前最优健康读副本的 drizzle 实例。
   * 优先返回优先级最高且健康的副本；全部不健康时回退到主库。
   */
  function getReader(): Db {
    let bestId: string | null = null
    let bestPriority = -1
    for (const [id, status] of replicaHealth) {
      if (status.healthy && status.priority > bestPriority) {
        bestPriority = status.priority
        bestId = id
      }
    }
    if (bestId !== null) {
      return replicaDbs.get(bestId) ?? dbWriter
    }
    return dbWriter
  }

  /**
   * 上报读副本健康状态（驱动故障转移）。
   *
   * 连续失败达 FAIL_THRESHOLD 后标记为不健康，getReader() 将跳过该副本。
   * 成功时减少失败计数，归零后恢复健康。
   */
  function reportReplicaHealth(replicaId: string, ok: boolean, lagSec = 0): void {
    const status = replicaHealth.get(replicaId)
    if (!status) return
    status.lagSec = lagSec
    if (ok) {
      status.failCount = Math.max(0, status.failCount - 1)
      if (status.failCount === 0) status.healthy = true
    } else {
      status.failCount++
      if (status.failCount >= FAIL_THRESHOLD) status.healthy = false
    }
    // 复制延迟过大也标记不健康
    if (lagSec > MAX_LAG_SEC) status.healthy = false
  }

  /** 获取所有读副本状态快照。 */
  function getReplicaStatuses(): ReplicaStatus[] {
    return Array.from(replicaHealth.values()).map((s) => ({ ...s }))
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
  }
}

export type ReadWriteDb = ReturnType<typeof createReadWriteDb>
