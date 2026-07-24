import { createHash } from 'node:crypto'
import { desc, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { auditLogsChain } from '@ihui/database'

/** 创世哈希 — 链首记录的 previousHash 占位值(64 个 0)。 */
export const GENESIS_HASH = '0'.repeat(64)

/** 审计日志条目 — 链中每条记录的业务数据。 */
export interface AuditEntry {
  action: string
  resourceType?: string
  resourceId?: string
  userId?: string
  details?: unknown
  ip?: string
  occurredAt?: Date
}

/** 链记录 — 持久化后的完整记录结构。 */
export interface ChainRecord {
  id: string
  previousHash: string
  hash: string
  data: AuditEntry
  createdAt: Date
}

/** 链存储抽象 — 支持内存实现(测试)与 DB 实现(生产)。 */
export interface AuditChainStorage {
  getLatest(): Promise<ChainRecord | null>
  getAll(): Promise<ChainRecord[]>
  insert(record: { previousHash: string; hash: string; data: AuditEntry }): Promise<ChainRecord>
}

/** 验证结果。 */
export interface VerifyResult {
  valid: boolean
  brokenAt?: number
  expectedHash?: string
  actualHash?: string
}

/**
 * 对 previousHash + JSON.stringify(data) 做 SHA256,返回 64 位 hex。
 */
export function computeHash(previousHash: string, data: AuditEntry): string {
  return createHash('sha256')
    .update(previousHash + JSON.stringify(data))
    .digest('hex')
}

/** 从 DB 行映射为 ChainRecord。 */
function rowToRecord(row: typeof auditLogsChain.$inferSelect): ChainRecord {
  return {
    id: row.id,
    previousHash: row.prevHash,
    hash: row.currentHash,
    createdAt: row.timestamp,
    data: {
      action: row.action,
      resourceType: row.resourceType ?? undefined,
      resourceId: row.resourceId ?? undefined,
      userId: row.userId ?? undefined,
      details: row.metadata,
      ip: row.ip ?? undefined,
      occurredAt: row.timestamp,
    },
  }
}

/**
 * 默认 DB 存储 — 惰性使用 db(构造时不访问 db,避免触发 config 校验)。
 */
export class DbAuditChainStorage implements AuditChainStorage {
  async getLatest(): Promise<ChainRecord | null> {
    const [row] = await db
      .select()
      .from(auditLogsChain)
      .orderBy(desc(auditLogsChain.timestamp))
      .limit(1)
    return row ? rowToRecord(row) : null
  }

  async getAll(): Promise<ChainRecord[]> {
    const rows = await db.select().from(auditLogsChain).orderBy(asc(auditLogsChain.timestamp))
    return rows.map(rowToRecord)
  }

  async insert(record: {
    previousHash: string
    hash: string
    data: AuditEntry
  }): Promise<ChainRecord> {
    const ts = record.data.occurredAt ?? new Date()
    const [row] = await db
      .insert(auditLogsChain)
      .values({
        timestamp: ts,
        userId: record.data.userId,
        action: record.data.action,
        resourceType: record.data.resourceType,
        resourceId: record.data.resourceId,
        ip: record.data.ip,
        metadata: record.data.details ?? {},
        prevHash: record.previousHash,
        currentHash: record.hash,
      })
      .returning()
    if (!row) throw new Error('audit chain insert 未返回记录')
    return rowToRecord(row)
  }
}

/**
 * SHA256 hash 链审计 — 追加日志时基于上一条 hash 计算当前 hash,形成不可篡改链。
 */
export class AuditChain {
  private storage: AuditChainStorage

  constructor(storage?: AuditChainStorage) {
    this.storage = storage ?? new DbAuditChainStorage()
  }

  async append(entry: AuditEntry): Promise<string> {
    const latest = await this.storage.getLatest()
    const previousHash = latest ? latest.hash : GENESIS_HASH
    const data: AuditEntry = entry.occurredAt ? entry : { ...entry, occurredAt: new Date() }
    const hash = computeHash(previousHash, data)
    await this.storage.insert({ previousHash, hash, data })
    return hash
  }

  async verify(): Promise<VerifyResult> {
    const records = await this.storage.getAll()
    let prevHash = GENESIS_HASH
    for (let i = 0; i < records.length; i++) {
      const record = records[i]!
      if (record.previousHash !== prevHash) {
        return {
          valid: false,
          brokenAt: i + 1,
          expectedHash: prevHash,
          actualHash: record.previousHash,
        }
      }
      const recomputed = computeHash(record.previousHash, record.data)
      if (record.hash !== recomputed) {
        return { valid: false, brokenAt: i + 1, expectedHash: recomputed, actualHash: record.hash }
      }
      prevHash = record.hash
    }
    return { valid: true }
  }
}
