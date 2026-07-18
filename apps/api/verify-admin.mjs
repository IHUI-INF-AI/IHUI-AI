import postgres from 'postgres'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL ?? 'postgresql://ihui:ihui_dev_d6412937d5e397bc@127.0.0.1:5432/ihui'
const sql = postgres(url, { max: 1, onnotice: () => {} })

// 尝试 admin123
const r = await sql`SELECT id, username, email, password_hash FROM users WHERE username = 'admin' AND email = '502319984@qq.com'`
console.log('找到 admin 用户:', r[0]?.id)
const hash = r[0]?.password_hash
if (hash) {
  const ok = await bcrypt.compare('admin123', hash)
  console.log('admin123 验证:', ok ? 'OK' : 'FAIL')
  if (!ok) {
    // 重设密码
    const newHash = await bcrypt.hash('admin123', 10)
    await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${r[0].id}`
    console.log('已重设 admin123 密码')
  }
}
await sql.end({ timeout: 1 })
