import { pgTable, bigserial, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * AI 模型同步日志表(2026-07-31 立,P0 ModelSyncService 持久化)。
 * 用途:持久化 ModelSyncService 每次同步的执行结果,
 *      供 admin 端点 `GET /api/llm/models/sync/history` 查询历史。
 *      替代原内存 SyncStatus dataclass(重启丢失历史)。
 */
export const aiModelSyncLog = pgTable(
  'ai_model_sync_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** 同步的 provider 标识(openai / anthropic / deepseek 等) */
    providerCode: text('provider_code').notNull(),
    /** 同步开始时间 */
    syncStartedAt: timestamp('sync_started_at', { withTimezone: true }).notNull(),
    /** 同步结束时间 */
    syncFinishedAt: timestamp('sync_finished_at', { withTimezone: true }).notNull(),
    /** 同步是否成功 */
    success: boolean('success').notNull(),
    /** 同步到的模型总数 */
    totalModels: integer('total_models').default(0).notNull(),
    /** 本次新增模型数 */
    newModels: integer('new_models').default(0).notNull(),
    /** 本次移除模型数 */
    removedModels: integer('removed_models').default(0).notNull(),
    /** 失败原因(成功时为空字符串) */
    error: text('error').default('').notNull(),
    /** 同步耗时(毫秒) */
    latencyMs: integer('latency_ms').default(0).notNull(),
    /** 同步类型:full=全量 / single=单 provider / dry_run=试运行 */
    syncType: text('sync_type').default('full').notNull(),
  },
  (t) => ({
    // 按开始时间倒序查询最近同步记录
    startedAtIdx: index('idx_ai_model_sync_log_started_at').on(t.syncStartedAt),
    // 按 provider + 时间倒序查询某 provider 的同步历史
    providerIdx: index('idx_ai_model_sync_log_provider').on(t.providerCode, t.syncStartedAt),
  }),
)

export type AiModelSyncLog = typeof aiModelSyncLog.$inferSelect
export type NewAiModelSyncLog = typeof aiModelSyncLog.$inferInsert
