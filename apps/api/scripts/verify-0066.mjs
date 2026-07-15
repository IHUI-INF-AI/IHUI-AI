import postgres from 'postgres'

const targets = [
  { url: 'postgresql://postgres:postgres@localhost:5432/ihui', name: 'dev ihui' },
  { url: 'postgresql://postgres:postgres@localhost:5432/ihui_test', name: 'test ihui_test' },
]
const tables = ['users', 'orders', 'payments', 'chat_messages', 'chat_favorites', 'comment_likes']

for (const { url, name } of targets) {
  const sql = postgres(url, { max: 1 })
  try {
    console.log(`\n========== ${name} (${url}) ==========`)
    console.log('=== A) tenant_id 列 + 默认值 + NOT NULL ===')
    for (const t of tables) {
      const rows = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = ${t} AND column_name = 'tenant_id'
      `
      const r = rows[0]
      if (!r) {
        console.log(`  ${t.padEnd(16)}  MISSING tenant_id`)
      } else {
        console.log(`  ${t.padEnd(16)}  type=${r.data_type} nullable=${r.is_nullable} default=${r.column_default}`)
      }
    }

    console.log('\n=== B) RLS 启用状态 (rowsecurity / forcerowsecurity) ===')
    const rlsRows = await sql`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname = ANY(${sql.array(tables)})
      ORDER BY relname
    `
    for (const r of rlsRows) {
      console.log(`  ${r.relname.padEnd(16)}  rowsecurity=${r.relrowsecurity}  forcerowsecurity=${r.relforcerowsecurity}`)
    }
  } catch (e) {
    console.error(`[FAIL] ${name}:`, e.message)
    process.exit(1)
  } finally {
    await sql.end({ timeout: 5 })
  }
}
