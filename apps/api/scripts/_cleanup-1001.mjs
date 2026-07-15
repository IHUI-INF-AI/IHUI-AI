import 'dotenv/config'
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })
try {
  console.log('=== 清理残留测试账号(phone=1001) ===')
  const before = await sql`SELECT count(*)::int AS c FROM users`
  console.log('清理前用户数:', before[0].c)

  const result = await sql`DELETE FROM users WHERE phone = '1001' AND is_system_admin = false RETURNING id, phone, nickname`
  console.log('已删除:', result.length, '行')
  for (const r of result) console.log(' ', JSON.stringify(r))

  const after = await sql`SELECT count(*)::int AS c FROM users`
  console.log('清理后用户数:', after[0].c)

  console.log('\n=== 最终用户列表 ===')
  const final = await sql`
    SELECT id, username, phone, email, role_id, is_system_admin
    FROM users
    ORDER BY is_system_admin DESC, created_at
  `
  for (const u of final) {
    console.log(JSON.stringify({
      username: u.username,
      phone: u.phone,
      email: u.email,
      role_id: u.role_id,
      isSystemAdmin: u.is_system_admin
    }))
  }
} catch (e) {
  console.error('ERR:', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
