import { createReadWriteDb, type Database } from '@ihui/database'
import { config } from '../config/index.js'

// 使用读写分离工厂创建主库(写)与读副本(读)
// 无 DATABASE_READ_REPLICA_URL 时,dbReader 自动回退到主库
const { dbWriter, dbReader, writerClient } = createReadWriteDb({
  url: config.DATABASE_URL,
  readReplicaUrl: config.DATABASE_READ_REPLICA_URL,
})

// 主库(写) — insert/update/delete 必须使用此客户端
export const db: Database = dbWriter
// 读副本(读) — 仅用于 SELECT 查询;无读副本时回退到主库
export const dbRead: Database = dbReader
// 原始 postgres.js 客户端，用于连接池指标采样
export const dbClient = writerClient

export type { Database }

/**
 * 安全获取 `.returning()` 的单条结果。
 * 若无结果抛出 Error(由调用方 catch 返回 500 + message,与现有 catch 模式一致)。
 * 用途:消除 `const [x] = ...returning(); if (!x) return reply.status(500).send(...)` 重复守卫。
 *
 * @example
 * // 替换前:
 * const [created] = await db.insert(t).values(v).returning()
 * if (!created) return reply.status(500).send(error(500, '创建失败'))
 * // 替换后:
 * const created = await returningOne(db.insert(t).values(v).returning(), '创建失败')
 */
export async function returningOne<T>(
  promise: Promise<T[]>,
  errorMessage = '数据库操作未返回记录',
): Promise<T> {
  const rows = await promise
  const row = rows[0]
  if (!row) throw new Error(errorMessage)
  return row
}
