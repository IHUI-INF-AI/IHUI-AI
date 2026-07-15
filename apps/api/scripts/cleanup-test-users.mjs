import 'dotenv/config'
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })
try {
  // 启用清理开关
  await sql`SET LOCAL app.allow_cleanup = 'true'`

  // 先列出要清理的账号
  const targets = await sql`
    SELECT id, username, phone, email, is_system_admin
    FROM users
    WHERE username IN ('e2e_admin', 'e2e_user')
       OR phone ~ '^[0-9]{1,4}$'
       OR phone LIKE '19900000%'
       OR phone = '13133287445'
  `
  console.log('即将清理', targets.length, '个测试账号:')
  for (const t of targets) console.log(' -', JSON.stringify(t))

  // 清理(保留 system admin),先删 refresh_tokens 避免 FK 约束
  const ids = targets.map((t) => t.id)
  if (ids.length > 0) {
    // 用 IN + 拼接 UUID 字符串,避免 sql.array() 类型推断
    const inList = ids.map((i) => `'${i}'`).join(',')
    await sql.unsafe(`DELETE FROM refresh_tokens WHERE user_id IN (${inList})`)
    const deleted = await sql`
      DELETE FROM users
      WHERE id <> ALL(SELECT id FROM users WHERE is_system_admin = true)
        AND (
          username IN ('e2e_admin', 'e2e_user')
          OR phone ~ '^[0-9]{1,4}$'
          OR phone LIKE '19900000%'
          OR phone = '13133287445'
        )
      RETURNING id
    `
    console.log('实际删除', deleted.length, '条 users + 关联 refresh_tokens')
  }

  // 校验
  const remaining = await sql`SELECT count(*)::int AS c FROM users`
  console.log('清理后总用户数:', remaining[0].c)
  const adminRow = await sql`SELECT username, email, phone, is_system_admin FROM users WHERE is_system_admin = true`
  console.log('保留的 system admin:', JSON.stringify(adminRow[0], null, 2))
} catch (e) {
  console.error('ERR:', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
