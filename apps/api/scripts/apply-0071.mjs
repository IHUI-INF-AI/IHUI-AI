import 'dotenv/config'
import postgres from 'postgres'
import { readFileSync } from 'fs'

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })

const sqlText = readFileSync('g:/IHUI-AI/packages/database/drizzle/0071_restore_admin_immutability.sql', 'utf-8')

try {
  await sql.unsafe(sqlText)
  console.log('OK 0071_restore_admin_immutability.sql applied')

  // 验证
  const func = await sql`
    SELECT prosrc FROM pg_proc WHERE proname = 'users_block_system_admin_modify' LIMIT 1
  `
  const src = func[0]?.prosrc || ''
  console.log('--- 触发器函数验证 ---')
  console.log('  包含 password_hash 不可变保护:', src.includes('"password_hash" IS DISTINCT FROM'))
  console.log('  完全不可变:', !src.match(/放行.*password_hash/) && !src.includes('only password_hash is allowed'))

  const admin = await sql`
    SELECT id, username, email, phone, password_hash
    FROM users
    WHERE is_system_admin = true
    LIMIT 1
  `
  const bcrypt = (await import('bcryptjs')).default
  const pwdOk = await bcrypt.compare('admin123', admin[0].password_hash)
  console.log('\n--- admin 账号验证 ---')
  console.log('  username:', admin[0].username)
  console.log('  email:', admin[0].email)
  console.log('  phone:', admin[0].phone)
  console.log('  password admin123 OK:', pwdOk)
} catch (e) {
  console.error('FAIL:', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
