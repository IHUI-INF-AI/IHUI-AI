import postgres from 'postgres'

const url = 'postgresql://postgres:postgres@localhost:5432/ihui_test'
const s = postgres(url, { max: 1 })

try {
  const rows = await s`
    SELECT
      tc.table_name AS from_table,
      kcu.column_name AS from_column,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'users'
      AND tc.table_schema = 'public'
      AND rc.delete_rule != 'CASCADE'
    GROUP BY tc.table_name, kcu.column_name, rc.delete_rule
    ORDER BY tc.table_name
  `
  console.log(`FK references to users WITHOUT CASCADE: ${rows.length}`)
  for (const r of rows) {
    console.log(`  ${r.from_table}.${r.from_column}  delete_rule=${r.delete_rule}`)
  }
} catch (e) {
  console.error('ERR:', e.message)
  process.exit(1)
} finally {
  await s.end({ timeout: 5 })
}
