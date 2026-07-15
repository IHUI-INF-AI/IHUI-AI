import { createReadWriteDb, type Database } from '@ihui/database'
import postgres from 'postgres'

const TEST_DB_URL = process.env.DATABASE_URL!

// 测试专用 DB 实例(独立连接池,与生产/开发隔离)
const { dbWriter, writerClient } = createReadWriteDb({
  url: TEST_DB_URL,
  max: 5,
})

// resetTestDb 专用持久连接(避免每次创建/关闭连接的开销)
const resetClient = postgres(TEST_DB_URL, { max: 1 })

/** 测试用 drizzle 实例(带完整 schema 绑定) */
export const testDb: Database = dbWriter

/** 关闭测试 DB 连接池(在 afterAll 中调用) */
export async function closeTestDb(): Promise<void> {
  await writerClient.end()
  await resetClient.end()
}

/**
 * 清空指定表(在 afterEach 中调用,确保测试间隔离)。
 * @param tables 要清空的表名列表;不传则清空所有业务表(慢,482 张表)
 * 建议测试中传入实际用到的表名以提升速度
 */
export async function resetTestDb(tables?: string[]): Promise<void> {
  let tableNames: string[]
  if (tables && tables.length > 0) {
    tableNames = tables
  } else {
    const rows = await resetClient`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename != '__drizzle_migrations'
    `
    tableNames = rows.map((r) => r.tablename as string)
  }
  if (tableNames.length === 0) return
  await resetClient.unsafe(
    `TRUNCATE TABLE ${tableNames.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  )
}
