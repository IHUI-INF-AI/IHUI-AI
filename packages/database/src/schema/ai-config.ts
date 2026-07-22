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
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * AI 模型配置表（ai_model_config）。
 * - 用户/管理员自定义模型供应商凭证（API Key 加密存储于 api_key_enc）。
 * - is_builtin: 内置供应商（只读，不可删除）。
 * - api_format: openai_chat / anthropic_messages / openai_responses。
 *
 * Phase 1 (2026-07-22) 扩展字段:provider_group / group_label / default_model_id /
 *   sort_order_in_group / health_status / last_health_check_at /
 *   usage_30d_tokens / usage_30d_cost_cents
 * 旧字段 100% 保留,旧代码读取仍可用(向后兼容)
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
    // --- Phase 1 扩展字段(2026-07-22) ---
    /** 分组代码(用户自定义,'default' = 默认分组) */
    providerGroup: varchar('provider_group', { length: 64 }),
    /** 分组显示名(冗余存储,避免前端 JOIN groups 表) */
    groupLabel: varchar('group_label', { length: 64 }),
    /** 当前 provider 下的默认 model id */
    defaultModelId: varchar('default_model_id', { length: 128 }),
    /** 组内排序 */
    sortOrderInGroup: integer('sort_order_in_group').default(0),
    /** 健康状态:unknown / healthy / degraded / down */
    healthStatus: varchar('health_status', { length: 16 }).default('unknown'),
    /** 最近一次健康检查时间 */
    lastHealthCheckAt: varchar('last_health_check_at', { length: 32 }),
    /** 30 天累计 token 用量 */
    usage30dTokens: bigint('usage_30d_tokens', { mode: 'number' }).default(0),
    /** 30 天累计费用(分) */
    usage30dCostCents: integer('usage_30d_cost_cents').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerIdx: index('ix_ai_model_config_owner').on(t.ownerUuid),
    enabledIdx: index('ix_ai_model_config_enabled').on(t.enabled),
    providerIdx: index('ix_ai_model_config_provider').on(t.providerCode),
    providerGroupIdx: index('ix_ai_model_config_provider_group').on(t.providerGroup),
    healthIdx: index('ix_ai_model_config_health').on(t.healthStatus),
  }),
)

/**
 * AI 模型配置 - 子表(1:N) ai_model_config_models(Phase 1,2026-07-22)
 */
export const aiModelConfigModels = pgTable(
  'ai_model_config_models',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    configId: bigint('config_id', { mode: 'number' }).notNull(),
    modelId: varchar('model_id', { length: 128 }).notNull(),
    displayName: varchar('display_name', { length: 256 }),
    contextLength: integer('context_length').default(32000),
    inputPricePer1k: integer('input_price_per_1k').default(0),
    outputPricePer1k: integer('output_price_per_1k').default(0),
    enabled: boolean('enabled').default(true),
    defaultParams: jsonb('default_params').default({}),
    isDefault: boolean('is_default').default(false),
    sortOrder: integer('sort_order').default(0),
    lastTestStatus: varchar('last_test_status', { length: 16 }),
    lastTestResponseMs: integer('last_test_response_ms'),
    lastTestedAt: varchar('last_tested_at', { length: 32 }),
    lastTestError: text('last_test_error'),
    extraMetadata: jsonb('extra_metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    configIdIdx: index('ai_model_config_models_config_id_idx').on(t.configId),
    enabledIdx: index('ai_model_config_models_enabled_idx').on(t.enabled),
    configModelUniq: unique('ai_model_config_models_config_id_model_id_unique').on(
      t.configId,
      t.modelId,
    ),
  }),
)

/**
 * AI 模型配置 - 用户自定义分组表(Phase 1,2026-07-22)
 */
export const aiModelConfigGroups = pgTable(
  'ai_model_config_groups',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userUuid: varchar('user_uuid', { length: 64 }).notNull(),
    groupCode: varchar('group_code', { length: 64 }).notNull(),
    groupLabel: varchar('group_label', { length: 64 }),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('ai_model_config_groups_user_uuid_idx').on(t.userUuid),
    userGroupUniq: unique('ai_model_config_groups_user_uuid_group_code_unique').on(
      t.userUuid,
      t.groupCode,
    ),
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
export type AiModelConfigModel = typeof aiModelConfigModels.$inferSelect
export type NewAiModelConfigModel = typeof aiModelConfigModels.$inferInsert
export type AiModelConfigGroup = typeof aiModelConfigGroups.$inferSelect
export type NewAiModelConfigGroup = typeof aiModelConfigGroups.$inferInsert
export type UserSkInfo = typeof userSkInfo.$inferSelect
export type NewUserSkInfo = typeof userSkInfo.$inferInsert
export type VideoGenerationTask = typeof videoGenerationTasks.$inferSelect
export type NewVideoGenerationTask = typeof videoGenerationTasks.$inferInsert
