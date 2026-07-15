import postgres from 'postgres'

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ihui'
const s = postgres(url, { max: 1 })

try {
  // Check which migrations are tracked
  const applied = await s`
    SELECT id, hash, created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY id
  `
  console.log(`Applied migrations: ${applied.length}`)
  for (const m of applied) {
    console.log(`  id=${m.id} created=${new Date(m.created_at * 1000).toISOString()}`)
  }

  // Check policies
  const policies = await s`
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users','orders','payments','chat_messages','chat_favorites','comment_likes')
    ORDER BY tablename, policyname
  `
  console.log(`\nActive RLS policies: ${policies.length}`)
  for (const p of policies) {
    console.log(`  ${p.tablename}.${p.policyname}`)
  }

  // Check system admin trigger
  const trig = await s`
    SELECT tgname, tgrelid::regclass as table_name
    FROM pg_trigger
    WHERE tgname LIKE '%system_admin%'
    ORDER BY tgrelid::regclass::text
  `
  console.log(`\nSystem admin triggers:`)
  for (const t of trig) {
    console.log(`  ${t.tgname} ON ${t.table_name}`)
  }

  // Check safe_tenant_id function
  const fn = await s`
    SELECT proname
    FROM pg_proc
    WHERE proname = 'safe_tenant_id'
  `
  console.log(`\nsafe_tenant_id function: ${fn.length > 0 ? 'EXISTS' : 'NOT FOUND'}`)

  // Check tenant_id columns
  const cols = await s`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenant_id'
    ORDER BY table_name
  `
  console.log(`\nTables with tenant_id column: ${cols.length}`)
  for (const c of cols) {
    console.log(`  ${c.table_name}.${c.column_name}`)
  }
} catch (e) {
  console.error('ERR:', e.message)
  process.exit(1)
} finally {
  await s.end({ timeout: 5 })
}
