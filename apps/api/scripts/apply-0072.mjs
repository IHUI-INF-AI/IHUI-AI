import 'dotenv/config'
import postgres from 'postgres'
import { readFileSync } from 'fs'

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })

const sqlText = readFileSync('g:/IHUI-AI/packages/database/drizzle/0072_drop_0066_rls_policies.sql', 'utf-8')

try {
  await sql.unsafe(sqlText)
  console.log('OK 0072_drop_0066_rls_policies.sql applied')

  // 验证:每个核心表只剩 0068 引入的策略(每个表 4 类:select/insert/update/delete)
  const policies = await sql`
    SELECT tablename, count(*)::int AS n
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'orders', 'payments', 'chat_messages', 'chat_favorites', 'comment_likes')
    GROUP BY tablename
    ORDER BY tablename
  `
  console.log('\n--- RLS 策略数量验证(应=4) ---')
  for (const p of policies) {
    const ok = p.n === 4 ? 'OK' : 'WARN'
    console.log(`  ${p.tablename.padEnd(20)} ${p.n} 策略 ${ok}`)
  }

  // 验证 _tenant_iso_ 策略已删除
  const leftover = await sql`
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE '%tenant_iso%'
  `
  console.log(`\n残留 _tenant_iso_* 策略数: ${leftover.length} ${leftover.length === 0 ? 'OK' : 'WARN'}`)
  if (leftover.length > 0) {
    for (const p of leftover) {
      console.log(`  ${p.tablename}.${p.policyname}`)
    }
  }
} catch (e) {
  console.error('FAIL:', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
