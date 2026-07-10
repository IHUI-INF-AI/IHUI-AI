import { createReadWriteDb, type Database } from '@ihui/database'
import { config } from '../config/index.js'

// 使用读写分离工厂创建主库(写)与读副本(读)
// 无 DATABASE_READ_REPLICA_URL 时,dbReader 自动回退到主库
const { dbWriter, dbReader } = createReadWriteDb({
  url: config.DATABASE_URL,
  readReplicaUrl: config.DATABASE_READ_REPLICA_URL,
})

// 主库(写) — insert/update/delete 必须使用此客户端
export const db: Database = dbWriter
// 读副本(读) — 仅用于 SELECT 查询;无读副本时回退到主库
export const dbRead: Database = dbReader

export type { Database }
