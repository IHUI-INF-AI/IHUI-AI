import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

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
  metadata: jsonb('metadata'),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

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
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

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
);

export type ChatConversation = typeof chatConversations.$inferSelect;
export type NewChatConversation = typeof chatConversations.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type ChatFavorite = typeof chatFavorites.$inferSelect;
export type NewChatFavorite = typeof chatFavorites.$inferInsert;
