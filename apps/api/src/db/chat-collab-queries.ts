// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, eq, inArray, ne } from 'drizzle-orm'
import { db } from './index.js'
import {
  chatConversationCollaborators,
  chatMessageComments,
  chatMessages,
  users,
  type ChatConversationCollaborator,
} from '@ihui/database'

// =============================================================================
// D125 协作会话查询(设计稿 docs/d125-session-collab-design.md)
// 计数/删除一律 RETURNING 库确认集(AGENTS §5),归属过滤在 where 里做。
// =============================================================================

/**
 * 建/重邀邀请(upsert):同一 (conversation, user) 只允许一行,重邀复位 pending
 * 并更新邀请人与档位 —— 不产生第二份"什么算一次邀请"。
 */
export async function upsertCollaboratorInvitation(input: {
  conversationId: string
  userId: string
  invitedBy: string
  tier: string
}): Promise<ChatConversationCollaborator> {
  const rows = await db
    .insert(chatConversationCollaborators)
    .values({
      conversationId: input.conversationId,
      userId: input.userId,
      invitedBy: input.invitedBy,
      tier: input.tier,
      status: 'pending',
    })
    .onConflictDoUpdate({
      target: [chatConversationCollaborators.conversationId, chatConversationCollaborators.userId],
      set: {
        invitedBy: input.invitedBy,
        tier: input.tier,
        status: 'pending',
        updatedAt: new Date(),
      },
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('upsertCollaboratorInvitation: RETURNING 未回吐行')
  return row
}

export async function listCollaborators(
  conversationId: string,
): Promise<ChatConversationCollaborator[]> {
  return db
    .select()
    .from(chatConversationCollaborators)
    .where(eq(chatConversationCollaborators.conversationId, conversationId))
    .orderBy(chatConversationCollaborators.createdAt)
}

/** 我的待处理邀请(消费面:接受入口) */
export async function listPendingInvitationsForUser(userId: string) {
  return db
    .select({
      conversationId: chatConversationCollaborators.conversationId,
      invitationId: chatConversationCollaborators.id,
      invitedBy: chatConversationCollaborators.invitedBy,
      tier: chatConversationCollaborators.tier,
      createdAt: chatConversationCollaborators.createdAt,
    })
    .from(chatConversationCollaborators)
    .where(
      and(
        eq(chatConversationCollaborators.userId, userId),
        eq(chatConversationCollaborators.status, 'pending'),
      ),
    )
}

export async function getCollaborator(
  conversationId: string,
  userId: string,
): Promise<ChatConversationCollaborator | null> {
  const rows = await db
    .select()
    .from(chatConversationCollaborators)
    .where(
      and(
        eq(chatConversationCollaborators.conversationId, conversationId),
        eq(chatConversationCollaborators.userId, userId),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

/**
 * 被邀请人接受:只有 (本会话, 本人, pending) 那一行会被翻正。
 * 返回库确认集 —— 空集 = 没有可接受的邀请(不存在/已裁决/不是本人),由路由判 404/403。
 */
export async function acceptCollaboratorInvitation(
  conversationId: string,
  userId: string,
): Promise<ChatConversationCollaborator[]> {
  // 条件更新即"先取现值再写":where 的 status='pending' 只在真翻转时命中,
  // 已裁决的行不会被同值空写推进 updatedAt(增量读不被假变化污染)。
  const changed = { status: 'accepted' } as const
  return db
    .update(chatConversationCollaborators)
    .set({ ...changed, updatedAt: new Date() })
    .where(
      and(
        eq(chatConversationCollaborators.status, 'pending'),
        eq(chatConversationCollaborators.conversationId, conversationId),
        // status 守卫:仅 pending 行会被翻正(终态不可逆出,防迟到/并发调用覆盖裁决)
        eq(chatConversationCollaborators.userId, userId),
      ),
    )
    .returning()
}

/** 属主撤销(软删):同上,库确认集判有没有真删到。revoked 为终态,守卫拒绝二次翻写。 */
export async function revokeCollaborator(
  conversationId: string,
  userId: string,
): Promise<ChatConversationCollaborator[]> {
  // 同上:where 的 status != 'revoked' 只在真翻转时命中,二次撤销不发 UPDATE、不盖 updatedAt。
  const changed = { status: 'revoked' } as const
  return db
    .update(chatConversationCollaborators)
    .set({ ...changed, updatedAt: new Date() })
    .where(
      and(
        ne(chatConversationCollaborators.status, 'revoked'),
        eq(chatConversationCollaborators.conversationId, conversationId),
        eq(chatConversationCollaborators.userId, userId),
      ),
    )
    .returning()
}

/** accepted 协作者 id 集合(评论 fan-out 收信人;不含属主,由调用方补)。 */
export async function listAcceptedCollaboratorUserIds(conversationId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: chatConversationCollaborators.userId })
    .from(chatConversationCollaborators)
    .where(
      and(
        eq(chatConversationCollaborators.conversationId, conversationId),
        eq(chatConversationCollaborators.status, 'accepted'),
      ),
    )
  return rows.map((r) => r.userId)
}

// =============================================================================
// 逐消息评论
// =============================================================================

export interface MessageCommentRow {
  id: string
  conversationId: string
  messageId: string
  userId: string
  body: string
  createdAt: Date
  /** 作者展示名:nickname 优先,回落 username(服务端盖章,不是评论行自报) */
  authorName: string | null
}

function toCommentRow(r: {
  id: string
  conversationId: string
  messageId: string
  userId: string
  body: string
  createdAt: Date
  authorName: string | null
  authorUsername: string | null
}): MessageCommentRow {
  const { authorUsername, ...rest } = r
  return { ...rest, authorName: r.authorName ?? authorUsername }
}

export async function listMessageComments(
  conversationId: string,
  messageId: string,
): Promise<MessageCommentRow[]> {
  const rows = await db
    .select({
      id: chatMessageComments.id,
      conversationId: chatMessageComments.conversationId,
      messageId: chatMessageComments.messageId,
      userId: chatMessageComments.userId,
      body: chatMessageComments.body,
      createdAt: chatMessageComments.createdAt,
      authorName: users.nickname,
      authorUsername: users.username,
    })
    .from(chatMessageComments)
    .leftJoin(users, eq(users.id, chatMessageComments.userId))
    .where(
      and(
        eq(chatMessageComments.conversationId, conversationId),
        eq(chatMessageComments.messageId, messageId),
      ),
    )
    .orderBy(chatMessageComments.createdAt)
  return rows.map(toCommentRow)
}

export async function createMessageComment(input: {
  conversationId: string
  messageId: string
  userId: string
  body: string
}): Promise<MessageCommentRow> {
  const rows = await db
    .insert(chatMessageComments)
    .values({
      conversationId: input.conversationId,
      messageId: input.messageId,
      userId: input.userId,
      body: input.body,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('createMessageComment: RETURNING 未回吐行')
  const author = await db
    .select({ nickname: users.nickname, username: users.username })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1)
  return {
    ...row,
    authorName: author[0]?.nickname ?? author[0]?.username ?? null,
  }
}

/**
 * 删评论:where 带 (本会话, 本消息, 本评论) 三重过滤;`userIds` 给定时再按作者集收窄
 * (非属主只能删自己的)。返回库确认集 id(空集 = 没删到,路由据此判 404)。
 */
export async function deleteMessageComment(input: {
  conversationId: string
  messageId: string
  commentId: string
  userIds?: string[]
}): Promise<string[]> {
  const conditions = [
    eq(chatMessageComments.id, input.commentId),
    eq(chatMessageComments.conversationId, input.conversationId),
    eq(chatMessageComments.messageId, input.messageId),
  ]
  if (input.userIds) conditions.push(inArray(chatMessageComments.userId, input.userIds))
  const rows = await db
    .delete(chatMessageComments)
    .where(and(...conditions))
    .returning({ id: chatMessageComments.id })
  return rows.map((r) => r.id)
}

/** 消息存在且属于该会话(评论落点校验,防跨会话挂评论)。 */
export async function messageInConversation(messageId: string, conversationId: string) {
  const rows = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(and(eq(chatMessages.id, messageId), eq(chatMessages.conversationId, conversationId)))
    .limit(1)
  return rows[0] ?? null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
