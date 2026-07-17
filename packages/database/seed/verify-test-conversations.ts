/**
 * 验证测试对话数据是否存在,以及绑定到哪个用户。
 * 用法:DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ihui pnpm --filter @ihui/database tsx seed/verify-test-conversations.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { chatConversations, chatMessages } from '../src/schema/chat.js'
import { users } from '../src/schema/users.js'
import { sql } from 'drizzle-orm'

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui'
const client = postgres(DATABASE_URL, { max: 1 })
const db = drizzle(client)

async function main() {
  console.info('[verify] DATABASE_URL =', DATABASE_URL)

  // 1. 查所有 admin 相关用户
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      nickname: users.nickname,
      roleId: users.roleId,
    })
    .from(users)
    .where(sql`email LIKE '%@ihui.ai' OR username LIKE '%admin%'`)
  console.info('\n[verify] 所有 @ihui.ai 或 admin 用户:')
  for (const u of allUsers) {
    console.info(
      `  - id=${u.id} email=${u.email} username=${u.username} nickname=${u.nickname} roleId=${u.roleId}`,
    )
  }

  // 2. 查所有对话(最近 20 条)
  const allConvs = await db
    .select({
      id: chatConversations.id,
      userId: chatConversations.userId,
      title: chatConversations.title,
      model: chatConversations.model,
      createdAt: chatConversations.createdAt,
    })
    .from(chatConversations)
    .orderBy(sql`${chatConversations.createdAt} DESC`)
    .limit(20)
  console.info(`\n[verify] 最近 20 条对话 (共 ${allConvs.length} 条):`)
  for (const c of allConvs) {
    console.info(
      `  - id=${c.id} userId=${c.userId} title="${c.title}" model=${c.model} createdAt=${c.createdAt?.toISOString()}`,
    )
  }

  // 3. 查所有消息总数
  const msgCount = await db.select({ count: sql<number>`count(*)::int` }).from(chatMessages)
  console.info(`\n[verify] 消息总数: ${msgCount[0]?.count ?? 0}`)

  await client.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('[verify] 失败:', err)
  process.exit(1)
})
