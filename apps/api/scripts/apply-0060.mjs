/**
 * 一次性应用 0060_r70_audit_logs_partition.sql 迁移。
 *
 * 背景: dev 数据库之前未应用 0060, audit_logs 仍为普通表, 仅 PK 索引。
 *       应用后: 改为 RANGE created_at 按月分区 + 4 个索引(user_id/action/resource/created_at)
 *
 * 安全措施:
 *   - 使用 IF NOT EXISTS / 守卫检查, 已应用可重跑
 *   - 16 个月分区覆盖过去 12 + 当月 + 未来 3
 *   - DEFAULT 分区兜底
 *   - 数据从 audit_logs_old 完整迁移
 */
import 'dotenv/config'
import postgres from 'postgres'
import { readFileSync } from 'fs'

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui'
const sqlText = readFileSync('g:/IHUI-AI/packages/database/drizzle/0060_r70_audit_logs_partition.sql', 'utf-8')
const sql = postgres(url, { max: 1 })

try {
  console.log('[INFO] applying 0060_r70_audit_logs_partition.sql to', url)
  await sql.unsafe(sqlText)
  console.log('[OK] 0060 applied')

  // 验证
  const isPartitioned = await sql`
    SELECT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'audit_logs' AND c.relkind = 'p' AND n.nspname = 'public'
    ) AS partitioned
  `
  console.log('[VERIFY] audit_logs is partitioned:', isPartitioned[0].partitioned)

  const idx = await sql`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'audit_logs' AND schemaname = 'public'
      AND indexname LIKE 'idx_audit_logs_%'
    ORDER BY indexname
  `
  console.log('[VERIFY] audit_logs custom indexes:', idx.length)
  for (const r of idx) console.log('  -', r.indexname)

  const part = await sql`
    SELECT count(*)::int AS n
    FROM pg_inherits i
    JOIN pg_class parent ON parent.oid = i.inhparent
    WHERE parent.relname = 'audit_logs'
  `
  console.log('[VERIFY] audit_logs partitions:', part[0].n)
} catch (e) {
  console.error('[FAIL]:', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
