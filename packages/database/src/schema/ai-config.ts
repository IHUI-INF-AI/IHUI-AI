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
  numeric,
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
    /**
     * BYOK 平台服务费抽成率(2026-07-30 立,numeric(5,4),默认 0.1000=10%)。
     * 用户用自己的 API Key 调用大厂模型时,平台只收抽成(上游原价 × 抽成率),不碰大厂成本。
     * 仅 owner_uuid IS NULL 的全局配置行生效(admin 配置的平台默认抽成率)。
     */
    byokCommissionRate: numeric('byok_commission_rate', { precision: 5, scale: 4 }).default(
      '0.1000',
    ),
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
    // --- P0-5 中转站字段(2026-07-29 立) ---
    /** 是否在中转站公开上架(/v1/models 返回此模型) */
    isRelayPublic: boolean('is_relay_public').default(false).notNull(),
    /** 中转站定价倍率(1.0 = 按上游原价,1.2 = 加价 20%),numeric(10,4) */
    relayPriceMultiplier: varchar('relay_price_multiplier', { length: 20 }).default('1.0000'),
    /** 中转站展示排序(越小越靠前) */
    relaySortOrder: integer('relay_sort_order').default(0).notNull(),
    /** 中转站展示名(为空时用 displayName/modelId) */
    relayDisplayName: varchar('relay_display_name', { length: 256 }),
    // --- ModelSyncService v3 元数据字段(2026-07-31 立) ---
    tags: text('tags').array().default([]),
    description: text('description'),
    vendor: varchar('vendor', { length: 64 }),
    maxOutputTokens: integer('max_output_tokens'),
    supportsToolCall: boolean('supports_tool_call').default(false),
    supportsVision: boolean('supports_vision').default(false),
    supportsStreaming: boolean('supports_streaming').default(true),
    rateLimitRpm: integer('rate_limit_rpm'),
    rateLimitTpd: integer('rate_limit_tpd'),
    releaseDate: varchar('release_date', { length: 32 }),
    deprecationDate: varchar('deprecation_date', { length: 32 }),
    upstreamETag: varchar('upstream_etag', { length: 255 }),
    upstreamLastModified: varchar('upstream_last_modified', { length: 64 }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    // --- 积分消耗倍数(2026-07-31 立,用户规则:平台内置模型积分消耗倍数) ---
    /** 积分消耗倍数(1.00=基准,0=免费,10=高级,30=旗舰)。扣分=token/1000×倍数。见 POINTS_MULTIPLIER_TIERS */
    pointsMultiplier: numeric('points_multiplier', { precision: 5, scale: 2 }).default('1.00').notNull(),
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
    relayPublicIdx: index('ai_model_config_models_relay_public_idx').on(t.isRelayPublic),
  }),
)

/**
 * 积分消耗倍数档位常量(2026-07-31 立,用户规则:平台内置模型积分消耗倍数)
 *
 * 计费公式:扣分 = (输入token + 输出token) / 1000 × points_multiplier × 1 积分基准
 * - 免费模型(zero_cost/local):0x(不扣分)
 * - 经济模型(mini/flash):1x(1千token=1积分)
 * - 标准模型(standard):3x(1千token=3积分)
 * - 高级模型(pro/max):10x(1千token=10积分)
 * - 旗舰模型(opus/thinking):30x(1千token=30积分)
 *
 * 字段:ai_model_config_models.points_multiplier numeric(5,2) default 1.00
 * 兜底:积分不足时降级到 zero_cost 模型(类似 Cursor slow request)
 */
export const POINTS_MULTIPLIER_TIERS = {
  FREE: 0,        // 免费模型(本地/zero_cost)
  ECONOMY: 1,     // 经济模型(mini/flash)
  STANDARD: 3,    // 标准模型
  PREMIUM: 10,    // 高级模型(pro/max)
  FLAGSHIP: 30,   // 旗舰模型(opus/thinking)
} as const

export type PointsMultiplierTier = typeof POINTS_MULTIPLIER_TIERS[keyof typeof POINTS_MULTIPLIER_TIERS]

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
