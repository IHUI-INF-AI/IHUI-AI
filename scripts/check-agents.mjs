import 'dotenv/config'
import postgres from 'postgres'

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })
try {
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name IN ('collect_count', 'publish_status', 'suggested_questions')
    ORDER BY column_name
  `
  console.log('agents table new columns:', cols.map(c => c.column_name))
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('zhs_agent_thumbs', 'zhs_agent_collect', 'zhs_agent_useDetail')
    ORDER BY table_name
  `
  console.log('agent interaction tables:', tables.map(t => t.table_name))
} catch (e) {
  console.error('error:', e.message)
} finally {
  await sql.end({ timeout: 5 })
}
