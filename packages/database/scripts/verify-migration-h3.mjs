/**
 * 验证 0046 迁移的 9 张新表是否正确创建
 */
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })

async function main() {
  const tables = [
    'edu_order_items',
    'resource_downloads',
    'resource_search_logs',
    'user_jobs',
    'edu_member_company_relations',
    'edu_member_level_relations',
    'edu_member_post_relations',
    'edu_member_tag_relations',
    'edu_resource_product_relations',
  ]

  console.log('[verify-migration-h3] 验证 9 张新表...\n')

  let allOk = true
  for (const table of tables) {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
      ORDER BY ordinal_position
    `
    if (cols.length === 0) {
      console.log(`✗ ${table} - 表不存在!`)
      allOk = false
    } else {
      console.log(`✓ ${table} (${cols.length} 列)`)
      for (const col of cols) {
        console.log(`  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'YES' ? ' NULL' : ' NOT NULL'}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`)
      }
    }
    console.log()
  }

  console.log(allOk ? '[verify-migration-h3] ✅ 全部 9 张表验证通过' : '[verify-migration-h3] ❌ 部分表验证失败')
  process.exit(allOk ? 0 : 1)
}

main().finally(() => sql.end())
