import 'dotenv/config'
import postgres from 'postgres'
import { readFileSync } from 'fs'

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui'
const sqlText = readFileSync('g:/IHUI-AI/packages/database/drizzle/0068_rls_policies.sql', 'utf-8')
const sql = postgres(url, { max: 1 })
try {
  await sql.unsafe(sqlText)
  console.log('OK 0068_rls_policies.sql applied to', url.replace(/:[^:@]+@/, ':***@'))

  // 验证 RLS 启用情况
  const tables = await sql`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'orders', 'payments', 'chat_messages', 'chat_favorites', 'comment_likes')
    ORDER BY tablename
  `
  console.log('--- RLS 状态验证 ---')
  for (const t of tables) {
    console.log(`  ${t.tablename.padEnd(20)} rls=${t.rowsecurity ? 'ON' : 'OFF'}`)
  }

  // 统计策略数
  const policyCount = await sql`
    SELECT tablename, count(*)::int as policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'orders', 'payments', 'chat_messages', 'chat_favorites', 'comment_likes')
    GROUP BY tablename
    ORDER BY tablename
  `
  console.log('--- 策略数量 ---')
  for (const p of policyCount) {
    console.log(`  ${p.tablename.padEnd(20)} policies=${p.policy_count}`)
  }
} catch (e) {
  console.error('FAIL:', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
