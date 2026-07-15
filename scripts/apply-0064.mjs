import 'dotenv/config'
import postgres from 'postgres'
import { readFileSync } from 'fs'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const sqlText = readFileSync('packages/database/drizzle/0064_agents_extension.sql', 'utf-8')
const sql = postgres(url, { max: 1 })
try {
  await sql.unsafe(sqlText)
  console.log('OK 0064_agents_extension.sql applied to', url)
} catch (e) {
  console.error('FAIL:', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
