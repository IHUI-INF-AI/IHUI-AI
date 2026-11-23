// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 联系人 / 群成员服务。
 *
 * 入站消息的 sender 自动落联系人；群桥推送 members 时同步群成员。
 * 联系人只维护本地备注/标签/拉黑，不回写微信平台。
 */

import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { wechatHubContacts, wechatHubConversations, wechatHubGroupMembers } from '@ihui/database'
import type {
  WechatContactUpdateInput,
  WechatContactView,
  WechatGroupMemberView,
} from '@ihui/types'
import { db, dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import {
  assertAccountForUser,
  assertContactForAccount,
  assertConversationForAccount,
} from './guards.js'
import type { WechatInboundEvent } from './types.js'

function toContactView(row: typeof wechatHubContacts.$inferSelect): WechatContactView {
  return {
    id: row.id,
    accountId: row.accountId,
    platformUserId: row.platformUserId,
    displayName: row.displayName,
    remark: row.remark,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    blocked: row.blocked,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toMemberView(row: typeof wechatHubGroupMembers.$inferSelect): WechatGroupMemberView {
  return {
    id: row.id,
    accountId: row.accountId,
    conversationId: row.conversationId,
    memberId: row.memberId,
    nickname: row.nickname,
    role: row.role,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** 入站消息发送者归档；重复消息也会刷新 lastSeenAt。 */
export async function recordInboundContact(
  accountId: string,
  event: WechatInboundEvent,
): Promise<void> {
  if (!event.senderId) return
  const inserted = await db
    .insert(wechatHubContacts)
    .values({
      accountId,
      platformUserId: event.senderId,
      displayName: event.senderName ?? '',
      lastSeenAt: event.sentAt,
      metadata: { source: event.conversationKind },
    })
    .onConflictDoNothing()
    .returning({ id: wechatHubContacts.id })
  if (inserted.length > 0) return
  await db
    .update(wechatHubContacts)
    .set({
      ...(event.senderName ? { displayName: event.senderName } : {}),
      lastSeenAt: event.sentAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(wechatHubContacts.accountId, accountId),
        eq(wechatHubContacts.platformUserId, event.senderId),
      ),
    )
}

/** 群成员快照同步；Associates 群成员到会话，并回写 memberCount。 */
export async function syncGroupMembers(
  accountId: string,
  conversationId: string,
  event: WechatInboundEvent,
): Promise<void> {
  if (event.conversationKind !== 'group') return
  const members = event.groupMembers?.length
    ? event.groupMembers
    : event.senderId
      ? [{ memberId: event.senderId, nickname: event.senderName ?? '', role: 'member' }]
      : []
  if (members.length === 0) return
  for (const member of members) {
    const inserted = await db
      .insert(wechatHubGroupMembers)
      .values({
        accountId,
        conversationId,
        memberId: member.memberId,
        nickname: member.nickname,
        role: member.role,
        metadata: {},
      })
      .onConflictDoNothing()
      .returning({ id: wechatHubGroupMembers.id })
    if (inserted.length > 0) continue
    await db
      .update(wechatHubGroupMembers)
      .set({
        ...(member.nickname ? { nickname: member.nickname } : {}),
        role: member.role,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(wechatHubGroupMembers.accountId, accountId),
          eq(wechatHubGroupMembers.conversationId, conversationId),
          eq(wechatHubGroupMembers.memberId, member.memberId),
        ),
      )
  }
  const counts = await dbRead
    .select({ count: sql<number>`count(*)::int` })
    .from(wechatHubGroupMembers)
    .where(
      and(
        eq(wechatHubGroupMembers.accountId, accountId),
        eq(wechatHubGroupMembers.conversationId, conversationId),
      ),
    )
  await db
    .update(wechatHubConversations)
    .set({ memberCount: counts[0]?.count ?? members.length, updatedAt: new Date() })
    .where(eq(wechatHubConversations.id, conversationId))
}

/** 自动回复前的本地拉黑闸；查不到人按未拉黑处理。 */
export async function isContactBlocked(
  accountId: string,
  platformUserId: string,
): Promise<boolean> {
  const rows = await dbRead
    .select({ blocked: wechatHubContacts.blocked })
    .from(wechatHubContacts)
    .where(
      and(
        eq(wechatHubContacts.accountId, accountId),
        eq(wechatHubContacts.platformUserId, platformUserId),
      ),
    )
    .limit(1)
  return rows[0]?.blocked ?? false
}

/** 找回群成员时按昵称/成员 id 模糊搜索。 */
export async function listContacts(
  userId: string,
  accountId: string,
  query = '',
): Promise<WechatContactView[]> {
  await assertAccountForUser(userId, accountId)
  const term = query.trim()
  const where = term
    ? and(
        eq(wechatHubContacts.accountId, accountId),
        sql`(${wechatHubContacts.displayName} ILIKE ${`%${term}%`} OR ${wechatHubContacts.remark} ILIKE ${`%${term}%`} OR ${wechatHubContacts.platformUserId} ILIKE ${`%${term}%`})`,
      )
    : eq(wechatHubContacts.accountId, accountId)
  const rows = await dbRead
    .select()
    .from(wechatHubContacts)
    .where(where)
    .orderBy(desc(wechatHubContacts.lastSeenAt), desc(wechatHubContacts.createdAt))
    .limit(200)
  return rows.map((row) => toContactView(row))
}

export async function updateContact(
  userId: string,
  accountId: string,
  contactId: string,
  patch: WechatContactUpdateInput,
): Promise<WechatContactView> {
  await assertAccountForUser(userId, accountId)
  await assertContactForAccount(accountId, contactId)
  const updated = await db
    .update(wechatHubContacts)
    .set({
      ...(patch.remark !== undefined ? { remark: patch.remark } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      ...(patch.blocked !== undefined ? { blocked: patch.blocked } : {}),
      updatedAt: new Date(),
    })
    .where(eq(wechatHubContacts.id, contactId))
    .returning()
  const row = updated[0]
  if (!row) throw new AppError('保存联系人失败', 500, 'WECHAT_CONTACT_UPDATE_FAILED')
  return toContactView(row)
}

export async function listGroupMembers(
  userId: string,
  accountId: string,
  conversationId: string,
): Promise<WechatGroupMemberView[]> {
  await assertAccountForUser(userId, accountId)
  await assertConversationForAccount(accountId, conversationId)
  const rows = await dbRead
    .select()
    .from(wechatHubGroupMembers)
    .where(
      and(
        eq(wechatHubGroupMembers.accountId, accountId),
        eq(wechatHubGroupMembers.conversationId, conversationId),
      ),
    )
    .orderBy(desc(wechatHubGroupMembers.role), wechatHubGroupMembers.nickname)
  return rows.map((row) => toMemberView(row))
}

/** 批量按成员 id 查昵称；自动回复 @ 时补显示名。 */
export async function findMemberNicknames(
  accountId: string,
  memberIds: string[],
): Promise<Record<string, string>> {
  if (memberIds.length === 0) return {}
  const rows = await dbRead
    .select({
      memberId: wechatHubGroupMembers.memberId,
      nickname: wechatHubGroupMembers.nickname,
    })
    .from(wechatHubGroupMembers)
    .where(
      and(
        eq(wechatHubGroupMembers.accountId, accountId),
        inArray(wechatHubGroupMembers.memberId, memberIds),
      ),
    )
  const result: Record<string, string> = {}
  for (const row of rows) result[row.memberId] = row.nickname
  return result
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
