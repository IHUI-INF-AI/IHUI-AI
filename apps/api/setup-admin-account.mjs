// 临时脚本: 更新 admin 账号为硬约束规范
import postgres from 'postgres'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL ?? 'postgresql://ihui:ihui_dev_d6412937d5e397bc@127.0.0.1:5432/ihui'
const sql = postgres(url, { max: 1, onnotice: () => {} })

try {
  const passwordHash = await bcrypt.hash('admin123', 10)
  console.log('admin123 bcrypt hash:', passwordHash)

  // 用 email = 'admin@ihui.ai' 更新
  const r1 = await sql`
    UPDATE users SET
      username = 'admin',
      email = '502319984@qq.com',
      phone = '18643389808',
      password_hash = ${passwordHash},
      nickname = 'Admin',
      role_id = 1,
      status = 1,
      is_system_admin = true,
      updated_at = NOW()
    WHERE email = 'admin@ihui.ai'
    RETURNING id, username, email, phone, role_id, is_system_admin, status
  `
  console.log('更新 admin@ihui.ai:', r1)

  // 验证
  const all = await sql`SELECT id, username, email, phone, role_id, is_system_admin, status, nickname FROM users WHERE role_id >= 1 ORDER BY id`
  console.log('\nrole_id >= 1 用户:')
  for (const u of all) {
    console.log(`  ${u.id} | ${u.username} | ${u.email} | ${u.phone} | role=${u.role_id} | sysadmin=${u.is_system_admin} | status=${u.status}`)
  }
} catch (e) {
  console.error('[ERR]', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 1 })
}
