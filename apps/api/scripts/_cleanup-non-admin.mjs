import 'dotenv/config'
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })
try {
  console.log('=== 当前非 admin 账号 ===')
  const nonAdmin = await sql`
    SELECT id, username, nickname, phone, email, role_id, is_system_admin, created_at, updated_at
    FROM users
    WHERE is_system_admin = false
    ORDER BY created_at
  `
  console.log('非 admin 账号数:', nonAdmin.length)
  for (const u of nonAdmin) {
    console.log(JSON.stringify({
      id: u.id,
      username: u.username,
      nickname: u.nickname,
      phone: u.phone,
      email: u.email,
      role_id: u.role_id,
      isSystemAdmin: u.is_system_admin,
      created: u.created_at,
      updated: u.updated_at
    }, null, 2))
  }

  if (nonAdmin.length === 0) {
    console.log('✓ 无非 admin 账号,DB 干净')
    process.exit(0)
  }

  console.log('\n=== 检查外键依赖(并行) ===')
  for (const u of nonAdmin) {
    const deps = []
    const tables = ['orders', 'payments', 'chat_conversations', 'chat_messages', 'refresh_tokens',
      'addresses', 'point_records', 'wallet_transactions', 'notifications',
      'user_video_comments', 'user_agent_images', 'share_contents', 'feedbacks',
      'withdrawals', 'settlements', 'user_agent_free_times', 'comment_likes',
      'chat_favorites']
    for (const t of tables) {
      try {
        const r = await sql`SELECT count(*)::int AS c FROM ${sql(t)} WHERE user_id = ${u.id}`
        if (r[0].c > 0) deps.push(`${t}=${r[0].c}`)
      } catch {}
    }
    console.log(`账号 ${u.id} 依赖:`, deps.length === 0 ? '无依赖(可安全删除)' : deps.join(', '))
  }

  console.log('\n=== 执行清理(删除所有非 admin 账号) ===')
  for (const u of nonAdmin) {
    try {
      const r = await sql`DELETE FROM users WHERE id = ${u.id} AND is_system_admin = false RETURNING id`
      console.log(`  删除 ${u.id}:`, r.length > 0 ? 'OK' : 'SKIP(可能并发已改)')
    } catch (e) {
      console.log(`  删除 ${u.id} 失败:`, e.message.split('\n')[0])
    }
  }

  console.log('\n=== 最终状态 ===')
  const final = await sql`
    SELECT id, username, phone, email, role_id, is_system_admin
    FROM users
    ORDER BY is_system_admin DESC, created_at
  `
  console.log('最终用户数:', final.length)
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
