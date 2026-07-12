/**
 * 审计日志归档（冷存储）。
 *
 * 将过期的审计日志从主库 audit_logs 表迁移到归档存储，
 * 保持主库表体积可控，提升查询性能。
 *
 * 归档策略：
 * 1. 查询 beforeDate 之前的审计日志（分批）
 * 2. 写入归档介质（此处用 JSON 序列化输出，可扩展为 S3/OSS）
 * 3. 从主库删除已归档记录
 *
 * 注意：归档操作不可逆，调用方应确保归档介质写入成功后再删除主库记录。
 */

import { lt, asc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { auditLogs, type AuditLog } from '@ihui/database'

/** 归档结果。 */
export interface ArchiveResult {
  /** 已归档的记录数 */
  archived: number
  /** 归档耗时（毫秒） */
  durationMs: number
  /** 归档介质的标识（如 S3 key、文件路径） */
  archiveKey?: string
}

/** 归档目标写入器（可替换为 S3 / OSS / 文件实现）。 */
export interface ArchiveWriter {
  /**
   * 将一批审计日志写入归档介质。
   * @returns 归档标识（如 S3 object key）
   */
  write(batch: AuditLog[]): Promise<string>
}

/** 默认归档写入器：将日志序列化为 JSON 字符串输出到控制台（占位实现）。 */
export class ConsoleArchiveWriter implements ArchiveWriter {
  async write(batch: AuditLog[]): Promise<string> {
    const key = `audit-archive-${Date.now()}-${batch.length}.json`
    // 生产环境应替换为 S3/OSS 上传；此处仅占位输出
    console.info(`[audit-archive] write ${batch.length} records to ${key}`)
    return key
  }
}

/** 归档选项。 */
export interface ArchiveOptions {
  /** 每批处理记录数，默认 1000 */
  batchSize?: number
  /** 归档写入器，默认 ConsoleArchiveWriter */
  writer?: ArchiveWriter
  /** 最大处理记录数（防止一次归档过多影响性能），默认无限制 */
  maxRecords?: number
}

/**
 * 归档指定日期之前的审计日志。
 *
 * @param beforeDate 归档此日期之前的记录
 * @returns 归档结果
 */
export async function archiveAuditLogs(
  beforeDate: Date,
  options: ArchiveOptions = {},
): Promise<ArchiveResult> {
  const startTime = Date.now()
  const { batchSize = 1000, writer = new ConsoleArchiveWriter() } = options
  let archived = 0
  let lastArchiveKey: string | undefined
  const maxRecords = options.maxRecords ?? Number.MAX_SAFE_INTEGER

  while (archived < maxRecords) {
    const remaining = maxRecords - archived
    const limit = Math.min(batchSize, remaining)
    if (limit <= 0) break

    // 1. 读取一批待归档记录（按 createdAt 升序）
    const batch = await db
      .select()
      .from(auditLogs)
      .where(lt(auditLogs.createdAt, beforeDate))
      .orderBy(asc(auditLogs.createdAt))
      .limit(limit)

    if (batch.length === 0) break

    // 2. 写入归档介质
    lastArchiveKey = await writer.write(batch)

    // 3. 从主库删除已归档记录（按 id 精确删除）
    const ids = batch.map((r) => r.id)
    await db.delete(auditLogs).where(sql`${auditLogs.id} = ANY(${ids})`)

    archived += batch.length

    // 若本批不足 batchSize，说明已无更多待归档记录
    if (batch.length < limit) break
  }

  return {
    archived,
    durationMs: Date.now() - startTime,
    archiveKey: lastArchiveKey,
  }
}
