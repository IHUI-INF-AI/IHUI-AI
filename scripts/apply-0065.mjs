import 'dotenv/config'
import postgres from 'postgres'
import { readFileSync } from 'fs'

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui_test'
const sqlText = readFileSync('packages/database/drizzle/0065_users_level.sql', 'utf-8')
const sql = postgres(url, { max: 1 })
try {
  await sql.unsafe(sqlText)
  console.log('OK 0065_users_level.sql applied to', url)
} catch (e) {
  console.error('FAIL:', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
