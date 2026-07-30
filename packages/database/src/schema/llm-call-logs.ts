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
    /** prompt cache 命中读取的 token 数(按 10% 价计费,OpenAI/Claude 标准) */
    cacheReadTokens: integer('cache_read_tokens').default(0).notNull(),
    /** prompt cache 创建写入的 token 数(按 125% 价计费) */
    cacheCreationTokens: integer('cache_creation_tokens').default(0).notNull(),
    latencyMs: integer('latency_ms').default(0).notNull(),
    status: varchar('status', { length: 20 }).default('success').notNull(),
    errorMessage: text('error_message'),
    conversationId: varchar('conversation_id', { length: 100 }),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    /** P0 中转站造血能力批次(2026-08-01):8 个审计/统计字段 */
    /** 调用所用 API Key id(关联 developer_api_keys.id) */
    apiKeyId: uuid('api_key_id'),
    /** 上游 provider 代码(如 'openai'/'anthropic'/'stepfun') */
    providerCode: varchar('provider_code', { length: 32 }),
    /** 所用模型配置 id(关联 ai_model_config.id) */
    configId: uuid('config_id'),
    /** 所用 key 池条目 id(关联 ai_relay_key_pool.id) */
    keyPoolId: uuid('key_pool_id'),
    /** 调用方 IP(支持 IPv4/IPv6) */
    clientIp: varchar('client_ip', { length: 45 }),
    /** 本次调用总成本(分,= input + output + cacheRead + cacheCreation) */
    costCents: integer('cost_cents'),
    /** 上游 HTTP 状态码(如 200/429/500) */
    httpStatus: integer('http_status'),
    /** Time To First Token 毫秒数(首 token 耗时,流式才有) */
    ttftMs: integer('ttft_ms'),
  },
  (t) => ({
    userIdx: index('llm_call_logs_user_idx').on(t.userId),
    modelIdx: index('llm_call_logs_model_idx').on(t.model),
    statusIdx: index('llm_call_logs_status_idx').on(t.status),
    createdAtIdx: index('llm_call_logs_created_at_idx').on(t.createdAt),
    apiKeyIdx: index('llm_call_logs_api_key_idx').on(t.apiKeyId),
    providerIdx: index('llm_call_logs_provider_idx').on(t.providerCode),
    clientIpIdx: index('llm_call_logs_client_ip_idx').on(t.clientIp),
    httpStatusIdx: index('llm_call_logs_http_status_idx').on(t.httpStatus),
  }),
)

export type LlmCallLog = typeof llmCallLogs.$inferSelect
export type NewLlmCallLog = typeof llmCallLogs.$inferInsert
