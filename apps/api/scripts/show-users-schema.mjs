import 'dotenv/config'
import postgres from 'postgres'
import { writeFileSync } from 'fs'

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })
try {
  const cols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `
  const idx = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes WHERE tablename = 'users'
    ORDER BY indexname
  `
  const trig = await sql`
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'users'
    ORDER BY trigger_name
  `
  writeFileSync('g:/IHUI-AI/users-schema.json', JSON.stringify({ cols, idx, trig }, null, 2))
  console.log('OK cols=' + cols.length + ' idx=' + idx.length + ' trig=' + trig.length)
} catch (e) {
  console.error('ERR:', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
