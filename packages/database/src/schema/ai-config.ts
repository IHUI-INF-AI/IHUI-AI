import {
  pgTable,
  bigserial,
  serial,
  varchar,
  integer,
  text,
  boolean,
  timestamp,
  bigint,
  index,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * AI 模型配置表（ai_model_config）。
 * - 用户/管理员自定义模型供应商凭证（API Key 加密存储于 api_key_enc）。
 * - is_builtin: 内置供应商（只读，不可删除）。
 * - api_format: openai_chat / anthropic_messages / openai_responses。
 */
export const aiModelConfig = pgTable(
  'ai_model_config',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    providerCode: varchar('provider_code', { length: 64 }).notNull(),
    isBuiltin: boolean('is_builtin').default(false).notNull(),
    baseUrl: varchar('base_url', { length: 500 }).notNull(),
    apiFormat: varchar('api_format', { length: 32 }).default('openai_chat').notNull(),
    apiKeyEnc: text('api_key_enc'),
    modelIdForTest: varchar('model_id_for_test', { length: 100 }),
    enabled: boolean('enabled').default(true).notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').default(0).notNull(),
    ownerUuid: varchar('owner_uuid', { length: 64 }),
    lastTestStatus: varchar('last_test_status', { length: 16 }),
    lastTestResponseMs: integer('last_test_response_ms'),
    lastTestedAt: varchar('last_tested_at', { length: 32 }),
    lastTestError: text('last_test_error'),
    extraConfig: text('extra_config'),
    /** 自定义 SVG 图标文本(0108 migration);为空时前端按 providerCode 回退到内置厂商图标 */
    iconSvg: text('icon_svg'),
    /**
     * CLI 配置导入溯源字段(2026-07-20 立,可空,向后兼容)
     * - importSource: 'cc-switch' | 'codex++' | 'claude-cli' | 'codex-cli' | 'gemini-cli' | 'hermes' | null
     * - importSourceId: 源工具中的 provider id(cc-switch) / relayProfile id(codex++)
     * - importSourceAppType: 仅 cc-switch,值为 CliAppType 8 值之一
     * 去重 partial unique index:
     *   CREATE UNIQUE INDEX ix_ai_model_config_import_unique
     *     ON ai_model_config (owner_uuid, import_source, import_source_id)
     *     WHERE import_source IS NOT NULL;
     */
    importSource: varchar('import_source', { length: 32 }),
    importSourceId: varchar('import_source_id', { length: 128 }),
    importSourceAppType: varchar('import_source_app_type', { length: 32 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerIdx: index('ix_ai_model_config_owner').on(t.ownerUuid),
    enabledIdx: index('ix_ai_model_config_enabled').on(t.enabled),
    providerIdx: index('ix_ai_model_config_provider').on(t.providerCode),
  }),
)

/**
 * 用户 API Key 信息表（user_sk_info）。
 * - status/type: 业务自定义状态/类型整型。
 * - max: 配额上限（bigint）。
 */
export const userSkInfo = pgTable(
  'user_sk_info',
  {
    id: serial('id').primaryKey(),
    userUuid: varchar('user_uuid', { length: 255 }),
    key: varchar('key', { length: 255 }),
    status: integer('status'),
    type: integer('type'),
    max: bigint('max', { mode: 'number' }),
    outTime: timestamp('out_time', { withTimezone: true }),
    /** 用户会话密钥过期时间 (P0-4 补齐) */
    expireAt: timestamp('expire_at', { withTimezone: true }),
    createdTime: timestamp('created_time', { withTimezone: true }).defaultNow().notNull(),
    updatedTime: timestamp('updated_time', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_user_sk_info_status').on(t.status),
    userUuidIdx: index('user_sk_info_user_uuid_idx').on(t.userUuid),
  }),
)

/**
 * 视频生成任务队列表（video_generation_tasks）。
 * - status: accepted/processing/succeeded/failed。
 * - result: 生成结果（URL/JSON 文本）。
 */
export const videoGenerationTasks = pgTable(
  'video_generation_tasks',
  {
    id: serial('id').primaryKey(),
    taskId: varchar('task_id', { length: 36 }).notNull(),
    userUuid: varchar('user_uuid', { length: 255 }).notNull(),
    chatId: varchar('chat_id', { length: 255 }),
    status: varchar('status', { length: 50 }).default('accepted').notNull(),
    message: varchar('message', { length: 512 }),
    result: text('result'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_video_generation_tasks_status').on(t.status),
    taskIdUniq: unique('video_generation_tasks_task_id_unique').on(t.taskId),
    userUuidIdx: index('video_generation_tasks_user_uuid_idx').on(t.userUuid),
  }),
)

export type AiModelConfig = typeof aiModelConfig.$inferSelect
export type NewAiModelConfig = typeof aiModelConfig.$inferInsert
export type UserSkInfo = typeof userSkInfo.$inferSelect
export type NewUserSkInfo = typeof userSkInfo.$inferInsert
export type VideoGenerationTask = typeof videoGenerationTasks.$inferSelect
export type NewVideoGenerationTask = typeof videoGenerationTasks.$inferInsert
