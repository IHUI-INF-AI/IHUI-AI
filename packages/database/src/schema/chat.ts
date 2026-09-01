// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  unique,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * AI 对话表。
 * 一个用户可拥有多个对话；model 默认 gpt-4o-mini；metadata 用于扩展字段。
 */
export const chatConversations = pgTable('chat_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 255 }).default('新对话').notNull(),
  model: varchar('model', { length: 64 }).default('gpt-4o-mini').notNull(),
  systemPrompt: text('system_prompt'),
  metadata: jsonb('metadata').default({}),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  compressedAt: timestamp('compressed_at', { withTimezone: true }),
  compressedContext: text('compressed_context'),
  // 2026-08-30 立:会话置顶。pinned=true 时按 pinnedAt 倒序排在列表最前;取消置顶置回 null。
  pinned: boolean('pinned').default(false).notNull(),
  pinnedAt: timestamp('pinned_at', { withTimezone: true }),
  // 2026-08-17 修复:drizzle-orm 0.45.2(patch 版)的 PgColumnBuilder 无 nullable/notNull 方法
  // (varchar 默认 nullable),用 .nullable() 会 TypeError 阻断 api 启动。仅用 .unique()。
  shareToken: varchar('share_token', { length: 32 }).unique(),
})

/**
 * 对话消息表。
 * role: 'user' | 'assistant' | 'system'；tokens 为该条消息消耗的 token 数。
 */
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id')
    .references(() => chatConversations.id, { onDelete: 'cascade' })
    .notNull(),
  role: varchar('role', { length: 16 }).default('user').notNull(),
  content: text('content').notNull(),
  tokens: integer('tokens'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  reasoning: text('reasoning'),
})

/**
 * 压缩归档表(2026-09-01 立,"归档记忆"能力)。
 * 自动上下文压缩触发时,把被压缩掉的原始消息数组整体落库归档 ——
 * 压缩从"黑箱有损"变成"透明可逆":用户可回看压缩前的原始消息。
 * messages 为被压缩的原始消息数组(jsonb),结构与 replaceMessages 持久化的消息一致(role/content/reasoning/tokens/metadata/createdAt)。
 */
export const conversationMessageArchives = pgTable(
  'conversation_message_archives',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => chatConversations.id, { onDelete: 'cascade' })
      .notNull(),
    messages: jsonb('messages').notNull(),
    messageCount: integer('message_count').notNull(),
    coveredChars: integer('covered_chars'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idx: index('ix_conversation_message_archives_conversation').on(t.conversationId),
  }),
)

/**
 * 收藏对话表。
 * (user_id, conversation_id) 唯一，避免重复收藏。
 */
export const chatFavorites = pgTable(
  'chat_favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    conversationId: uuid('conversation_id')
      .references(() => chatConversations.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: unique().on(t.userId, t.conversationId),
  }),
)

export type ChatConversation = typeof chatConversations.$inferSelect
export type NewChatConversation = typeof chatConversations.$inferInsert
export type ChatMessage = typeof chatMessages.$inferSelect
export type NewChatMessage = typeof chatMessages.$inferInsert
export type ChatFavorite = typeof chatFavorites.$inferSelect
export type NewChatFavorite = typeof chatFavorites.$inferInsert
export type ConversationMessageArchive = typeof conversationMessageArchives.$inferSelect
export type NewConversationMessageArchive = typeof conversationMessageArchives.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
