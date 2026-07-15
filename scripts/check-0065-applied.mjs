/* eslint-disable no-console */
import postgres from 'postgres'

console.log('=== 0065 migration 应用状态 ===')

const databases = [
  { name: 'ihui (生产)', url: 'postgresql://postgres:postgres@localhost:5432/ihui' },
  { name: 'ihui_test (测试)', url: 'postgresql://postgres:postgres@localhost:5432/ihui_test' },
]

for (const { name, url } of databases) {
  let sql
  try {
    sql = postgres(url, { max: 1, connect_timeout: 3, onnotice: () => {} })
    const rows = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'level'
    `
    if (rows.length === 1) {
      const r = rows[0]
      console.log(
        `${name}: ✅ 已应用 (${r.column_name} | ${r.data_type} | ${r.is_nullable} | default=${r.column_default ?? 'null'})`,
      )
    } else {
      console.log(`${name}: ❌ 未应用 (level 列不存在)`)
    }
  } catch (e) {
    console.log(`${name}: ⚠️ 无法连接 - ${e.message}`)
  } finally {
    if (sql) await sql.end()
  }
}

process.exit(0)
