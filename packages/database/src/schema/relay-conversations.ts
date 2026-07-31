import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { developerApiKeys } from './developer-api-keys.js'
import { llmCallLogs } from './llm-call-logs.js'

/**
 * 中转站用户对话会话历史(2026-08-01 立,B 端协作场景)。
 *
 * 用途:中转站用户通过 API Key 调用时附带 conversation_id 保存对话历史,
 * 区别于平台 chat 表(C 端用户聊天)。
 *
 * - relayConversations:一个 conversation_id 对应一个会话(标题/模型/统计)
 * - relayMessages:每条 message 一行(user/assistant/system),关联 llm_call_logs
 */
export const relayConversations = pgTable(
  'relay_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 用户传入的 conversation_id(或自动生成 conv_<uuid16>) */
    conversationId: varchar('conversation_id', { length: 100 }).notNull().unique(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    apiKeyId: uuid('api_key_id')
      .references(() => developerApiKeys.id, { onDelete: 'cascade' })
      .notNull(),
    /** 会话标题(取首条消息前 50 字符) */
    title: varchar('title', { length: 200 }),
    /** 最后使用的模型 */
    model: varchar('model', { length: 100 }),
    messageCount: integer('message_count').default(0).notNull(),
    totalTokens: bigint('total_tokens', { mode: 'number' }).default(0).notNull(),
    totalCostCents: integer('total_cost_cents').default(0).notNull(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_relay_conversations_user').on(t.userId, t.lastMessageAt),
    apiKeyIdx: index('idx_relay_conversations_api_key').on(t.apiKeyId),
    userUpdatedIdx: index('idx_relay_conversations_user_updated').on(t.userId, t.updatedAt),
  }),
)

export const relayMessages = pgTable(
  'relay_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => relayConversations.id, { onDelete: 'cascade' })
      .notNull(),
    /** 关联调用日志(llm_call_logs.id),删除日志时 SET NULL 保留消息 */
    logId: uuid('log_id').references(() => llmCallLogs.id, { onDelete: 'set null' }),
    /** user/assistant/system */
    role: varchar('role', { length: 20 }).notNull(),
    content: text('content').notNull(),
    model: varchar('model', { length: 100 }),
    promptTokens: integer('prompt_tokens').default(0).notNull(),
    completionTokens: integer('completion_tokens').default(0).notNull(),
    totalTokens: integer('total_tokens').default(0).notNull(),
    costCents: integer('cost_cents').default(0).notNull(),
    latencyMs: integer('latency_ms'),
    /** success/error */
    status: varchar('status', { length: 20 }).default('success').notNull(),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    conversationIdx: index('idx_relay_messages_conversation').on(t.conversationId, t.createdAt),
    logIdx: index('idx_relay_messages_log').on(t.logId),
  }),
)

export type RelayConversation = typeof relayConversations.$inferSelect
export type NewRelayConversation = typeof relayConversations.$inferInsert
export type RelayMessage = typeof relayMessages.$inferSelect
export type NewRelayMessage = typeof relayMessages.$inferInsert
