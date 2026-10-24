// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { chatConversations, chatMessages } from './chat.js'

/**
 * D125(2026-10-23 立,owner 2026-09-27 拍板开放面)多用户协作会话 —— 邀请/协作关系表。
 *
 * 与会话只读分享(share_token 匿名页)是两条腿:分享无身份无写面,协作逐人登记、
 * 只读审阅 + 逐消息评论。设计稿见 docs/d125-session-collab-design.md。
 *
 * `tier` 直接取 workspace-permissions 既有四档的 wire 拼写(唯一真源
 * `@ihui/types/permission-mode` 的 PERMISSION_MODE_WIRE_VALUES,此处不抄第二份清单;
 * DB 层 check 只封闭四值字面量,与注册表由 types 侧测试对账)。本切片**只授予 `plan`**
 * (只读 + 评论);写档留给"接管发言"另批 —— 列先立全,授权面后补,避免另批翻改数据模型。
 *
 * `status` 软删(revoked)而不是删行:撤销是"曾经邀请过"的事实,审计要能回答
 * "谁在何时被谁邀请又被撤销";重邀走 upsert 复位 pending(见 (conversation_id, user_id) 唯一)。
 */
export const chatConversationCollaborators = pgTable(
  'chat_conversation_collaborators',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => chatConversations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    invitedBy: uuid('invited_by')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tier: varchar('tier', { length: 24 }).notNull().default('plan'),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    convUserUniq: unique('uq_chat_conv_collaborators').on(t.conversationId, t.userId),
    userStatusIdx: index('ix_chat_conv_collaborators_user_status').on(t.userId, t.status),
    convIdx: index('ix_chat_conv_collaborators_conversation').on(t.conversationId),
    tierChk: check(
      'chat_conv_collaborators_tier_check',
      sql`${t.tier} in ('default', 'plan', 'accept-edits', 'bypass-permissions')`,
    ),
    statusChk: check(
      'chat_conv_collaborators_status_check',
      sql`${t.status} in ('pending', 'accepted', 'revoked')`,
    ),
  }),
)

/**
 * D125 逐消息评论表。
 *
 * conversation_id 冗余存储与 D49 chat_message_feedbacks 同一先例:按会话聚合
 * ("这条会话里所有未读评论")免 join chat_messages;评论与消息同生命周期,级联删除。
 *
 * 广播帧只带 id(collab:comment,拉取制),正文以本表为唯一真相 —— 这里不存第二份投影。
 */
export const chatMessageComments = pgTable(
  'chat_message_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => chatConversations.id, { onDelete: 'cascade' })
      .notNull(),
    messageId: uuid('message_id')
      .references(() => chatMessages.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    msgIdx: index('ix_chat_message_comments_message').on(t.messageId),
    convIdx: index('ix_chat_message_comments_conversation').on(t.conversationId),
  }),
)

export type ChatConversationCollaborator = typeof chatConversationCollaborators.$inferSelect
export type NewChatConversationCollaborator = typeof chatConversationCollaborators.$inferInsert
export type ChatMessageComment = typeof chatMessageComments.$inferSelect
export type NewChatMessageComment = typeof chatMessageComments.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
