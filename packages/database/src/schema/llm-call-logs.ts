// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
  bigint,
  boolean,
} from 'drizzle-orm/pg-core'
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
 * 注意:prompt / response 是原文列,自 2026-09-21(O5)起受**留存策略**约束:
 *  - rawRetentionDays 决定该行原文留几天(NULL → 全局默认 LLM_CALL_LOG_RAW_RETENTION_DAYS=30);
 *  - 到期由 services/audit-log-service.ts 的 purgeExpiredLlmCallLogRawText() 清成
 *    prompt='' / response=NULL,并置 rawRetained=false + rawPurgedAt=now();
 *  - 计费/统计一律只看 token 计数列,不依赖原文,清理后聚合口径不变。
 * 清除器实现与默认值理由见该 service 的「原文留存治理」段。
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
    /** 所用模型配置 id(关联 ai_model_config.id,bigint 主键;2026-09-13 由 uuid 修正以对齐实库列类型) */
    configId: bigint('config_id', { mode: 'number' }),
    /** 所用 key 池条目 id(关联 ai_relay_key_pool.id) */
    keyPoolId: uuid('key_pool_id'),
    /** 调用方 IP(支持 IPv4/IPv6) */
    clientIp: varchar('client_ip', { length: 45 }),
    /** 本次调用总成本(分,= input + output + cacheRead + cacheCreation) */
    costCents: numeric('cost_cents', { precision: 18, scale: 6, mode: 'number' }),
    /** 上游 HTTP 状态码(如 200/429/500) */
    httpStatus: integer('http_status'),
    /** Time To First Token 毫秒数(首 token 耗时,流式才有) */
    ttftMs: integer('ttft_ms'),
    /** 调用类型(2026-09-13 立):chat(默认)|image|video——多模态计费/审计维度 */
    callType: varchar('call_type', { length: 16 }).default('chat').notNull(),
    /**
     * ── O5 原文留存治理(2026-09-21)──
     * 背景:prompt / response 两列存的是**完整原文**,与"只开放功能、不开放数据"的口径冲突
     * (见 AGENTS.md 与 .qoder-cn memory「Agent 全面开放工程」)。计费与统计只需要 token 数,
     * 原文只对"失败复现"有价值 → 从"无限期留存"改为"有期限、可按 key 关闭、可批量清除"。
     *
     * 三列全部**新增且向后兼容**:prompt/response 仍是 NOT NULL/可空原样,旧行 raw_retained
     * 取 DEFAULT true → 旧数据照旧可读,读取方一行代码都不用改。
     */
    /**
     * 本行原文留存天数。NULL = 用全局默认(环境变量 LLM_CALL_LOG_RAW_RETENTION_DAYS,默认 30);
     * 0 = 本行不留存原文(下一次清除批次即抹掉);写入口可按 key 策略显式置 0。
     */
    rawRetentionDays: integer('raw_retention_days'),
    /** 原文当前是否仍在表内。清除器置 false;写入口亦可显式置 false(表示本就不写原文)。 */
    rawRetained: boolean('raw_retained').default(true).notNull(),
    /** 原文被清除的时间;NULL = 尚未清除。保留该列以便回答"这条记录的原文何时按策略消失"。 */
    rawPurgedAt: timestamp('raw_purged_at', { withTimezone: true }),
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
    // 注:留存清除扫描(WHERE raw_retained = true AND created_at < cutoff)
    // 刻意**不新建索引** —— 复用既有 llm_call_logs_created_at_idx 做范围扫,
    // 本表是高频写入的计费流水表,再加一条索引只换来写放大,收益不成比例。
  }),
)

export type LlmCallLog = typeof llmCallLogs.$inferSelect
export type NewLlmCallLog = typeof llmCallLogs.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
