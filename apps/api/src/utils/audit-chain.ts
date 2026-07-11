/**
 * SHA256 hash 链审计日志（防篡改）。
 *
 * 每条记录包含 previousHash + 当前数据 → hash，形成 append-only 链。
 * 任何中间记录被篡改都会导致后续 hash 校验失败。
 * 可独立于 Fastify 使用，存储后端通过 AuditChainStorage 抽象注入。
 */

import { createHash } from 'node:crypto'
import { desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { auditChainEntries, type AuditChainEntry } from '@ihui/database'

/** 链中单条审计数据。 */
export interface AuditEntry {
  /** 操作类型，如 POST / PATCH / 业务动作名 */
  action: string
  /** 资源类型 */
  resourceType?: string
  /** 资源 ID */
  resourceId?: string
  /** 操作人 ID */
  userId?: string
  /** 业务上下文详情 */
  details?: unknown
  /** 客户端 IP */
  ip?: string
  /** 时间戳（默认 now） */
  occurredAt?: Date
}

/** 链条目持久化结构（存储层接口）。 */
export interface ChainRecord {
  id: string
  previousHash: string
  hash: string
  data: AuditEntry
  createdAt: Date
}

/** 存储后端抽象：可注入 DB / 文件 / S3 等实现。 */
export interface AuditChainStorage {
  /** 读取链中最后一条记录（无记录时返回 null）。 */
  getLatest(): Promise<ChainRecord | null>
  /** 按 createdAt 升序读取全部记录（用于整链校验）。 */
  getAll(): Promise<ChainRecord[]>
  /** 追加一条记录。 */
  insert(record: { previousHash: string; hash: string; data: AuditEntry }): Promise<ChainRecord>
}

/** 链校验结果。 */
export interface ChainVerifyResult {
  valid: boolean
  /** 断裂位置（1-based 序号，从 1 开始）；valid=true 时为 undefined */
  brokenAt?: number
  /** 断裂处的预期 hash 与实际 hash */
  expectedHash?: string
  actualHash?: string
}

/** 创世 hash（链起点固定值）。 */
export const GENESIS_HASH = '0'.repeat(64)

/**
 * 计算单条记录的 hash。
 * hash = sha256(previousHash + stable_json(data))
 */
export function computeHash(previousHash: string, data: AuditEntry): string {
  const stableJson = JSON.stringify(data, Object.keys(data).sort())
  return createHash('sha256').update(previousHash).update(stableJson).digest('hex')
}

/** 默认 DB 存储实现：使用 audit_chain_entries 表。 */
export class DbAuditChainStorage implements AuditChainStorage {
  async getLatest(): Promise<ChainRecord | null> {
    const rows = await db
      .select()
      .from(auditChainEntries)
      .orderBy(desc(auditChainEntries.createdAt))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    return {
      id: row.id,
      previousHash: row.previousHash,
      hash: row.hash,
      data: row.data as AuditEntry,
      createdAt: row.createdAt,
    }
  }

  async getAll(): Promise<ChainRecord[]> {
    const rows = await db.select().from(auditChainEntries)
    // 按 createdAt 升序返回（链顺序）
    return rows
      .map((r: AuditChainEntry) => ({
        id: r.id,
        previousHash: r.previousHash,
        hash: r.hash,
        data: r.data as AuditEntry,
        createdAt: r.createdAt,
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  async insert(record: {
    previousHash: string
    hash: string
    data: AuditEntry
  }): Promise<ChainRecord> {
    const rows = await db
      .insert(auditChainEntries)
      .values({
        previousHash: record.previousHash,
        hash: record.hash,
        data: record.data,
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error('审计链写入失败')
    return {
      id: row.id,
      previousHash: row.previousHash,
      hash: row.hash,
      data: row.data as AuditEntry,
      createdAt: row.createdAt,
    }
  }
}

/**
 * 审计 hash 链。
 * 通过 storage 抽象与具体存储后端解耦，可独立测试/复用。
 */
export class AuditChain {
  constructor(private storage: AuditChainStorage = new DbAuditChainStorage()) {}

  /**
   * 追加一条审计记录到链尾。
   * @returns 新记录的 hash
   */
  async append(entry: AuditEntry): Promise<string> {
    const normalized: AuditEntry = {
      ...entry,
      occurredAt: entry.occurredAt ?? new Date(),
    }
    const latest = await this.storage.getLatest()
    const previousHash = latest?.hash ?? GENESIS_HASH
    const hash = computeHash(previousHash, normalized)
    await this.storage.insert({ previousHash, hash, data: normalized })
    return hash
  }

  /**
   * 校验整条链完整性。
   * 任一记录的 previousHash 与上一条 hash 不符，或 hash 重算不一致，均视为断裂。
   */
  async verify(): Promise<ChainVerifyResult> {
    const records = await this.storage.getAll()
    let previousHash = GENESIS_HASH
    for (let i = 0; i < records.length; i++) {
      const record = records[i]!
      // 1. previousHash 必须与上一条 hash 链接
      if (record.previousHash !== previousHash) {
        return {
          valid: false,
          brokenAt: i + 1,
          expectedHash: previousHash,
          actualHash: record.previousHash,
        }
      }
      // 2. hash 重算必须一致（防止 data 被篡改）
      const recomputed = computeHash(record.previousHash, record.data)
      if (recomputed !== record.hash) {
        return {
          valid: false,
          brokenAt: i + 1,
          expectedHash: recomputed,
          actualHash: record.hash,
        }
      }
      previousHash = record.hash
    }
    return { valid: true }
  }
}
