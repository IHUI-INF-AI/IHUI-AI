// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联归属校验单源。
 * 所有服务层入口都必须先过这里：账号必须属于当前 userId，
 * 会话必须属于该账号，避免各模块各写一份查询条件后漂移。
 */

import { and, eq } from 'drizzle-orm'
import { wechatHubAccounts, wechatHubContacts, wechatHubConversations } from '@ihui/database'
import { dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import type { AccountRow, ConversationRow } from './views.js'

export async function assertAccountForUser(userId: string, accountId: string): Promise<AccountRow> {
  const rows = await dbRead
    .select()
    .from(wechatHubAccounts)
    .where(and(eq(wechatHubAccounts.id, accountId), eq(wechatHubAccounts.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new AppError('微信账号不存在', 404, 'WECHAT_ACCOUNT_NOT_FOUND')
  return row
}

export async function assertConversationForAccount(
  accountId: string,
  conversationId: string,
): Promise<ConversationRow> {
  const rows = await dbRead
    .select()
    .from(wechatHubConversations)
    .where(
      and(
        eq(wechatHubConversations.id, conversationId),
        eq(wechatHubConversations.accountId, accountId),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row) throw new AppError('会话不存在', 404, 'WECHAT_CONVERSATION_NOT_FOUND')
  return row
}

/** 解析联系人 id 所属账号，防止跨账号改写别人的联系人。 */
export async function assertContactForAccount(
  accountId: string,
  contactId: string,
): Promise<{ id: string; platformUserId: string }> {
  const rows = await dbRead
    .select({ id: wechatHubContacts.id, platformUserId: wechatHubContacts.platformUserId })
    .from(wechatHubContacts)
    .where(and(eq(wechatHubContacts.id, contactId), eq(wechatHubContacts.accountId, accountId)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new AppError('联系人不存在', 404, 'WECHAT_CONTACT_NOT_FOUND')
  return row
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
