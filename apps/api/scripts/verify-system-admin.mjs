import 'dotenv/config'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })
try {
  const admin = await sql`
    SELECT id, username, email, phone, role_id, status, is_system_admin, password_hash, created_at
    FROM users
    WHERE username = 'admin' OR email = '502319984@qq.com' OR phone = '18643389808'
  `
  console.log('Found', admin.length, 'admin-related rows:')
  for (const u of admin) {
    const ok = await bcrypt.compare('admin123', u.password_hash)
    console.log(JSON.stringify({ ...u, password_hash: '[REDACTED]', password_admin123: ok }, null, 2))
  }
  // Trigger immutability test
  console.log('\n--- 触发器测试 ---')
  try {
    await sql`UPDATE users SET nickname = '尝试改名' WHERE is_system_admin = true`
    console.log('UNEXPECTED: UPDATE 居然成功了,触发器未生效!')
  } catch (e) {
    console.log('OK UPDATE 触发器拦截:', e.message.split('\n')[0])
  }
  try {
    await sql`DELETE FROM users WHERE is_system_admin = true`
    console.log('UNEXPECTED: DELETE 居然成功了,触发器未生效!')
  } catch (e) {
    console.log('OK DELETE 触发器拦截:', e.message.split('\n')[0])
  }
  // updated_at 唯一例外应该允许
  try {
    await sql`UPDATE users SET updated_at = now() WHERE is_system_admin = true`
    console.log('OK updated_at 例外通过')
  } catch (e) {
    console.log('FAIL updated_at 例外被拒:', e.message)
  }
  // 测试账号数
  const total = await sql`SELECT count(*)::int AS c FROM users`
  console.log('\n总用户数:', total[0].c)
  const testAccts = await sql`SELECT count(*)::int AS c FROM users WHERE phone ~ '^[0-9]{1,4}$' OR phone LIKE '19900000%' OR username IN ('e2e_admin','e2e_user') OR phone = '13133287445'`
  console.log('残留测试账号数:', testAccts[0].c)
} catch (e) {
  console.error('ERR:', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
