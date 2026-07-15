import 'dotenv/config'
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })
try {
  console.log('=== 0074 应用状态检查 ===')
  const tenantIsoPolicies = await sql`
    SELECT tablename, policyname FROM pg_policies
    WHERE policyname LIKE '%_tenant_iso_%'
    ORDER BY tablename, policyname
  `
  console.log('_tenant_iso_* 策略数量:', tenantIsoPolicies.length)
  for (const p of tenantIsoPolicies) console.log(' ', p.tablename, '/', p.policyname)

  console.log('\n=== safe_tenant_id 函数检查 ===')
  const fn = await sql`SELECT proname FROM pg_proc WHERE proname = 'safe_tenant_id'`
  console.log('safe_tenant_id 函数:', fn.length > 0 ? 'EXISTS' : 'NOT EXISTS')

  console.log('\n=== 1001 测试账号外键依赖检查 ===')
  const testUser = await sql`SELECT id FROM users WHERE phone = '1001' LIMIT 1`
  if (testUser.length === 0) {
    console.log('1001 账号已不存在')
  } else {
    const testId = testUser[0].id
    console.log('1001 账号 id:', testId)

    const tables = [
      'orders', 'payments', 'chat_conversations', 'chat_messages',
      'chat_favorites', 'comment_likes', 'refresh_tokens', 'addresses',
      'user_agent_free_times', 'point_records', 'wallet_transactions',
      'notifications', 'user_video_comments', 'user_agent_images',
      'share_contents', 'feedbacks', 'withdrawals', 'settlements'
    ]
    for (const t of tables) {
      try {
        const r = await sql`SELECT count(*)::int AS c FROM ${sql(t)} WHERE user_id = ${testId}`
        if (r[0].c > 0) console.log(`  ${t}: ${r[0].c} 行`)
      } catch {
        // 表不存在或无 user_id 列,跳过
      }
    }
  }

  console.log('\n=== 用户表全部数据(供清理决策) ===')
  const allUsers = await sql`
    SELECT id, username, phone, email, role_id, is_system_admin, created_at
    FROM users
    ORDER BY created_at
  `
  for (const u of allUsers) {
    console.log(JSON.stringify({
      id: u.id,
      username: u.username,
      phone: u.phone,
      email: u.email,
      role_id: u.role_id,
      isSystemAdmin: u.is_system_admin,
      created: u.created_at
    }))
  }
} catch (e) {
  console.error('ERR:', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
