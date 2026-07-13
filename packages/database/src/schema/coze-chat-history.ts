import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * Coze 聊天历史记录表。
 * - botId: Coze bot 标识。
 * - conversationId: Coze 会话标识。
 * - role: 消息角色（user/assistant/system 等）。
 */
export const cozeChatHistory = pgTable(
  'coze_chat_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    botId: varchar('bot_id', { length: 100 }).notNull(),
    conversationId: varchar('conversation_id', { length: 100 }).notNull(),
    role: varchar('role', { length: 20 }).notNull(),
    content: text('content'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    botConvIdx: index('ix_coze_chat_history_bot_conv').on(t.botId, t.conversationId),
  }),
)

export type CozeChatHistory = typeof cozeChatHistory.$inferSelect
export type NewCozeChatHistory = typeof cozeChatHistory.$inferInsert
