// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联只读查询：会话 / 消息 / 搜索 / 审计。
 * 从 manager 拆出，避免 manager 继续变胖；鉴权统一走 guards。
 */

import { and, desc, eq, ilike } from 'drizzle-orm'
import { wechatHubActionLogs, wechatHubConversations, wechatHubMessages } from '@ihui/database'
import type { WechatActionLogView, WechatConversationView, WechatMessageView } from '@ihui/types'
import { dbRead } from '../../db/index.js'
import { assertAccountForUser, assertConversationForAccount } from './guards.js'
import { toActionView, toConversationView, toMessageView } from './views.js'

export async function listConversations(
  userId: string,
  accountId: string,
  limit = 50,
): Promise<WechatConversationView[]> {
  await assertAccountForUser(userId, accountId)
  const rows = await dbRead
    .select()
    .from(wechatHubConversations)
    .where(eq(wechatHubConversations.accountId, accountId))
    .orderBy(desc(wechatHubConversations.lastMessageAt))
    .limit(Math.min(Math.max(limit, 1), 200))
  return rows.map((row) => toConversationView(row))
}

export async function listMessages(
  userId: string,
  accountId: string,
  conversationId: string | null,
  limit = 50,
  before: Date | null = null,
): Promise<WechatMessageView[]> {
  await assertAccountForUser(userId, accountId)
  if (conversationId) {
    await assertConversationForAccount(accountId, conversationId)
  }
  const where = conversationId
    ? and(
        eq(wechatHubMessages.accountId, accountId),
        eq(wechatHubMessages.conversationId, conversationId),
      )
    : eq(wechatHubMessages.accountId, accountId)
  const rows = await dbRead
    .select()
    .from(wechatHubMessages)
    .where(where)
    .orderBy(desc(wechatHubMessages.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200))
  const filtered = before ? rows.filter((row) => row.createdAt.getTime() < before.getTime()) : rows
  return filtered.reverse().map((row) => toMessageView(row))
}

export async function searchMessages(
  userId: string,
  accountId: string,
  query: string,
  limit = 20,
): Promise<WechatMessageView[]> {
  await assertAccountForUser(userId, accountId)
  const term = query.trim()
  if (term.length === 0) return []
  const rows = await dbRead
    .select()
    .from(wechatHubMessages)
    .where(
      and(
        eq(wechatHubMessages.accountId, accountId),
        ilike(wechatHubMessages.content, `%${term.replace(/[%_]/g, '\\$&')}%`),
      ),
    )
    .orderBy(desc(wechatHubMessages.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100))
  return rows.reverse().map((row) => toMessageView(row))
}

export async function listActions(
  userId: string,
  accountId: string,
  limit = 100,
): Promise<WechatActionLogView[]> {
  await assertAccountForUser(userId, accountId)
  const rows = await dbRead
    .select()
    .from(wechatHubActionLogs)
    .where(
      and(eq(wechatHubActionLogs.accountId, accountId), eq(wechatHubActionLogs.userId, userId)),
    )
    .orderBy(desc(wechatHubActionLogs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200))
  return rows.map((row) => toActionView(row))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
