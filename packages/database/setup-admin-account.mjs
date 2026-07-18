// 临时脚本: 用 bcryptjs 生成 admin123 密码 hash,并更新 users 表 admin 用户为硬约束规范
import postgres from 'postgres'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL ?? 'postgresql://ihui:ihui_dev_d6412937d5e397bc@127.0.0.1:5432/ihui'
const sql = postgres(url, { max: 1, onnotice: () => {} })

try {
  // 先看 users 表结构
  const cols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position
  `
  console.log('=== users 表结构 ===')
  for (const c of cols) {
    console.log(`  ${c.column_name.padEnd(20)} ${c.data_type.padEnd(20)} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`)
  }

  // 看现有 admin 用户
  const adminUser = await sql`SELECT id, email, phone, username, nickname, role_id, status FROM users WHERE email = 'admin@ihui.ai' LIMIT 1`
  console.log('\n=== 现有 admin@ihui.ai 用户 ===')
  console.log(adminUser[0] ?? '(not found)')

  // 生成 admin123 密码 hash
  const passwordHash = await bcrypt.hash('admin123', 10)
  console.log(`\n=== 生成 admin123 密码 hash ===\n${passwordHash}`)

  // 更新 admin 用户的邮箱/手机号/用户名/密码/roleId
  // 兼容可能的字段名 (snake_case 优先)
  let updated = 0
  try {
    const r = await sql`
      UPDATE users SET
        username = 'admin',
        email = '502319984@qq.com',
        phone = '18643389808',
        password_hash = ${passwordHash},
        nickname = 'Admin',
        role_id = 1,
        status = 1,
        updated_at = NOW()
      WHERE email = 'admin@ihui.ai' OR username = 'admin' OR id = 1
      RETURNING id, username, email, phone, role_id
    `
    console.log('\n=== 更新结果 ===')
    console.log(r)
    updated = r.length
  } catch (e) {
    console.log('\n[retry with different column] snake_case 失败,尝试其他字段名...')
    console.log('  Error:', e.message)
  }

  if (updated === 0) {
    // 尝试用全限定列名
    const r = await sql`
      UPDATE users
      SET "passwordHash" = ${passwordHash},
          "roleId" = 1,
          nickname = 'Admin',
          status = 1
      WHERE email = 'admin@ihui.ai' OR id = 1
      RETURNING id, email
    `
    console.log('camelCase 更新结果:', r)
  }

  // 验证
  const verify = await sql`SELECT id, username, email, phone, role_id, status, nickname FROM users WHERE role_id >= 1 ORDER BY id`
  console.log('\n=== role_id >= 1 用户 ===')
  console.log(verify)
} catch (e) {
  console.error('[ERR]', e.message, e.stack)
  process.exit(1)
} finally {
  await sql.end({ timeout: 1 })
}
