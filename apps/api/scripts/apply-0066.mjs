import postgres from 'postgres'
import { readFileSync } from 'fs'

// 目标:dev + test 数据库(任务规约 dev 必填,test 是真实测试也需要)
const targets = [
  { url: 'postgresql://postgres:postgres@localhost:5432/ihui', name: 'dev ihui' },
  { url: 'postgresql://postgres:postgres@localhost:5432/ihui_test', name: 'test ihui_test' },
]
const sqlText = readFileSync('g:/IHUI-AI/packages/database/drizzle/0066_rls_tenant_isolation.sql', 'utf-8')

for (const { url, name } of targets) {
  const sql = postgres(url, { max: 1 })
  try {
    console.log(`[INFO] applying 0066_rls_tenant_isolation.sql to ${name} (${url})`)
    await sql.unsafe(sqlText)
    console.log(`[OK] ${name}: 0066 applied`)
  } catch (e) {
    console.error(`[FAIL] ${name}:`, e.message)
    process.exit(1)
  } finally {
    await sql.end({ timeout: 5 })
  }
}
