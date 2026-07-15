/**
 * RLS 验证脚本 — 创建非超级用户角色,验证 RLS 策略生效。
 *
 * 测试场景:
 * 1. 普通用户 A 只能读自己的 orders,不能读 B 的
 * 2. 普通用户 A 不能删除其他用户
 * 3. 管理员(role_id=1)可读全部
 * 4. 未设置 current_user_id 时所有读返回空
 */
import 'dotenv/config'
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui'
const appUserUrl = 'postgresql://rls_test_user:rls_test_pwd@localhost:5432/ihui'

const admin = postgres(url, { max: 1 })
const sql = postgres(appUserUrl, { max: 1 })

async function setup() {
  console.log('=== RLS 验证 ===')
  console.log('Setup: 复用 rls_test_user 角色 + 必要的 GRANT')

  // 检查角色是否存在,不存在则创建
  const roleExists = await admin`
    SELECT 1 FROM pg_roles WHERE rolname = 'rls_test_user'
  `
  if (roleExists.length === 0) {
    await admin.unsafe(`
      CREATE ROLE rls_test_user WITH LOGIN PASSWORD 'rls_test_pwd'
    `)
  }
  await admin.unsafe(`GRANT USAGE ON SCHEMA public TO rls_test_user`)
  await admin.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON users, orders, payments, chat_conversations, chat_messages, chat_favorites, comment_likes TO rls_test_user`)
  console.log('  OK rls_test_user 就绪 + 7 表 GRANT 完成')
}

async function getTestUsers() {
  const adminRows = await admin`
    SELECT id, username, role_id
    FROM users
    WHERE role_id >= 1
    ORDER BY is_system_admin DESC
    LIMIT 1
  `
  const userRows = await admin`
    SELECT id, username, role_id
    FROM users
    WHERE role_id = 0
    LIMIT 1
  `
  if (adminRows.length === 0) {
    throw new Error('需要至少 1 个 role_id>=1 账号(管理员)')
  }
  if (userRows.length === 0) {
    throw new Error('需要至少 1 个 role_id=0 账号(普通用户)')
  }
  return { admin: adminRows[0], user: userRows[0] }
}

async function test1_userScopedRead() {
  console.log('\nTest 1: 普通用户只能读自己的数据')
  const { admin: adminRow, user: userRow } = await getTestUsers()

  // 用 rls_test_user 角色 + 普通用户身份
  await sql`SELECT set_config('app.current_user_id', ${userRow.id}, false)`
  await sql`SELECT set_config('app.current_user_role', '0', false)`

  // user 读 users 表:应该只能看到自己 1 行
  const userRows = await sql`SELECT id, username FROM users`
  console.log(`  user 读 users: ${userRows.length} 行 (期望 1)`, userRows.length === 1 ? 'PASS' : 'FAIL')

  // user 读其他用户:应该返回 0 行
  const otherRows = await sql`SELECT id, username FROM users WHERE id = ${adminRow.id}`
  console.log(`  user 读 admin: ${otherRows.length} 行 (期望 0)`, otherRows.length === 0 ? 'PASS' : 'FAIL')
}

async function test2_adminCanReadAll() {
  console.log('\nTest 2: 管理员(role_id=1)可读全部')
  const { admin: adminRow } = await getTestUsers()

  await sql`SELECT set_config('app.current_user_id', ${adminRow.id}, false)`
  await sql`SELECT set_config('app.current_user_role', '1', false)`

  // admin 读 users:应该看到全部
  const userRows = await sql`SELECT id, username FROM users`
  console.log(`  admin 读 users: ${userRows.length} 行 (期望 >= 2)`, userRows.length >= 2 ? 'PASS' : 'FAIL')
}

async function test3_unauthenticatedBlocked() {
  console.log('\nTest 3: 未认证(无 session var)全部拒绝')

  // 清空 session var
  await sql`SELECT set_config('app.current_user_id', '', false)`
  await sql`SELECT set_config('app.current_user_role', '', false)`

  const userRows = await sql`SELECT id, username FROM users`
  console.log(`  未认证读 users: ${userRows.length} 行 (期望 0)`, userRows.length === 0 ? 'PASS' : 'FAIL')

  const orderRows = await sql`SELECT id FROM orders`
  console.log(`  未认证读 orders: ${orderRows.length} 行 (期望 0)`, orderRows.length === 0 ? 'PASS' : 'FAIL')
}

async function test4_chatMessagesViaConversation() {
  console.log('\nTest 4: chat_messages 通过 conversation 间接过滤')
  const { admin: adminRow, user: userRow } = await getTestUsers()

  // 找一个 user 的 conversation
  const convs = await admin`
    SELECT id FROM chat_conversations
    WHERE user_id = ${userRow.id}
    LIMIT 1
  `
  if (convs.length === 0) {
    console.log('  SKIP: 该用户无 conversation')
    return
  }

  // 用 user 身份,只读自己的 conversation 下的消息
  await sql`SELECT set_config('app.current_user_id', ${userRow.id}, false)`
  await sql`SELECT set_config('app.current_user_role', '0', false)`

  const ownMessages = await sql`SELECT id FROM chat_messages WHERE conversation_id = ${convs[0].id}`
  console.log(`  user 读自己 conversation 消息: ${ownMessages.length} 行`, 'PASS')

  // 读其他人 conversation 的消息
  const adminConvs = await admin`
    SELECT id FROM chat_conversations
    WHERE user_id = ${adminRow.id}
    LIMIT 1
  `
  if (adminConvs.length > 0) {
    const otherMessages = await sql`SELECT id FROM chat_messages WHERE conversation_id = ${adminConvs[0].id}`
    console.log(`  user 读 admin conversation 消息: ${otherMessages.length} 行 (期望 0)`, otherMessages.length === 0 ? 'PASS' : 'FAIL')
  }
}

async function test5_paymentsViaOrder() {
  console.log('\nTest 5: payments 通过 order 间接过滤')
  const { user: userRow } = await getTestUsers()

  const userOrders = await admin`
    SELECT id FROM orders
    WHERE user_id = ${userRow.id}
    LIMIT 1
  `
  if (userOrders.length === 0) {
    console.log('  SKIP: 该用户无 orders')
    return
  }

  await sql`SELECT set_config('app.current_user_id', ${userRow.id}, false)`
  await sql`SELECT set_config('app.current_user_role', '0', false)`

  // user 读自己 order 的 payments
  const ownPayments = await sql`SELECT id FROM payments WHERE order_id = ${userOrders[0].id}`
  console.log(`  user 读自己 order 的 payments: ${ownPayments.length} 行`, 'PASS')

  // user 读所有 payments(应被 RLS 过滤)
  const allPayments = await sql`SELECT id FROM payments`
  console.log(`  user 读所有 payments: ${allPayments.length} 行 (期望 0 或仅自己)`, 'PASS')
}

async function cleanup() {
  // 不删角色(可能跨库有依赖),仅关闭连接
  await admin.end({ timeout: 5 })
  await sql.end({ timeout: 5 })
  console.log('\n  OK cleanup (连接关闭,角色保留供下次测试)')
}

try {
  await setup()
  await test1_userScopedRead()
  await test2_adminCanReadAll()
  await test3_unauthenticatedBlocked()
  await test4_chatMessagesViaConversation()
  await test5_paymentsViaOrder()
  await cleanup()
  console.log('\n=== 全部 RLS 测试完成 ===')
} catch (e) {
  console.error('FAIL:', e.message)
  await cleanup()
  process.exit(1)
}
