import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * LLM 调用流水表(记录用户每次 LLM 调用的输入/输出/性能/状态)。
 *
 * 用途:
 *  - 计费与配额审计(按 userId + model 聚合 token 用量)
 *  - 性能监控(按 latencyMs 分布排查慢调用)
 *  - 失败排查(status='error' + errorMessage 定位上游问题)
 *  - 行为分析(按 prompt/response 文本检索,做合规审计)
 *
 * 注意:完整 prompt/response 可能很长,生产环境可考虑异步归档到 OSS。
 */
export const llmCallLogs = pgTable(
  'llm_call_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    model: varchar('model', { length: 100 }).notNull(),
    prompt: text('prompt').notNull(),
    response: text('response'),
    promptTokens: integer('prompt_tokens').default(0).notNull(),
    completionTokens: integer('completion_tokens').default(0).notNull(),
    totalTokens: integer('total_tokens').default(0).notNull(),
    latencyMs: integer('latency_ms').default(0).notNull(),
    status: varchar('status', { length: 20 }).default('success').notNull(),
    errorMessage: text('error_message'),
    conversationId: varchar('conversation_id', { length: 100 }),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('llm_call_logs_user_idx').on(t.userId),
    modelIdx: index('llm_call_logs_model_idx').on(t.model),
    statusIdx: index('llm_call_logs_status_idx').on(t.status),
    createdAtIdx: index('llm_call_logs_created_at_idx').on(t.createdAt),
  }),
)

export type LlmCallLog = typeof llmCallLogs.$inferSelect
export type NewLlmCallLog = typeof llmCallLogs.$inferInsert
