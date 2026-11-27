// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  bigint,
  integer,
  timestamp,
  decimal,
  jsonb,
  index,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * 智能体（Agent）主表。
 * status: pending(待审核) / published(已发布) / rejected(已驳回) / offline(已下架)。
 * isFree=true 时为免费智能体，price 字段忽略。
 * isVipExclusive=true 时为 VIP 会员专享智能体（对齐旧架构 zhs_agent_category.group==1），非 VIP 用户无权购买/访问。
 * workspaceId 关联工作空间（外部约定，非 DB 外键）。
 *
 * Coze 配置字段（H-3 补齐）：agentVersion/botId/botName/agentPrompt/agentModel/
 * agentTemperature/agentMaxTokens/agentVariables/publishChannel/usageCount/
 * likeCount/shareCount/cozeAccountId 等，用于本地缓存 Coze 配置与离线管理。
 */
export const agents = pgTable(
  'agents',
  {
    agentId: uuid('agent_id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    avatar: varchar('avatar', { length: 500 }),
    cover: varchar('cover', { length: 500 }),
    categoryId: uuid('category_id'),
    userId: uuid('user_id'),
    workspaceId: varchar('workspace_id', { length: 100 }),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    price: integer('price').default(0).notNull(),
    isFree: boolean('is_free').default(true).notNull(),
    isVipExclusive: boolean('is_vip_exclusive').default(false).notNull(),
    sort: integer('sort').default(0).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    remark: text('remark'),
    // Coze 配置字段（H-3 补齐，等价自旧架构 agent_models.py；2026-11-28 扩到 BotInfo 全量）
    agentVersion: varchar('agent_version', { length: 32 }),
    botId: varchar('bot_id', { length: 64 }),
    botIdStr: varchar('bot_id_str', { length: 64 }),
    botName: varchar('bot_name', { length: 200 }),
    agentPrompt: text('agent_prompt'),
    /** 提示词模式：standard / prefix */
    agentPromptMode: varchar('agent_prompt_mode', { length: 32 }),
    /** 前缀缓存模式下的 prefix_prompt / dynamic_prompt */
    agentPrefixPrompt: jsonb('agent_prefix_prompt').$type<Record<string, unknown>>(),
    /** 本项目可路由模型名（与 Coze 展示名解耦，避免把 Coze model_name 写进路由） */
    agentModel: varchar('agent_model', { length: 100 }),
    /** Coze 模型数字 ID */
    cozeModelId: varchar('coze_model_id', { length: 64 }),
    /** Coze 模型展示名 */
    cozeModelName: varchar('coze_model_name', { length: 200 }),
    /** 生成随机性 0~2，保留三位小数 */
    agentTemperature: decimal('agent_temperature', { precision: 4, scale: 3 }),
    agentMaxTokens: integer('agent_max_tokens'),
    agentVariables: text('agent_variables'),
    /** 变量原样 JSON，避免 text 编码丢失结构 */
    cozeVariablesRaw: jsonb('coze_variables_raw').$type<unknown[]>(),
    /** 采样候选集大小 */
    cozeTopK: integer('coze_top_k'),
    /** Top P 采样 0~1 */
    cozeTopP: decimal('coze_top_p', { precision: 4, scale: 3 }),
    /** 携带上下文轮数 */
    cozeContextRound: integer('coze_context_round'),
    /** text / markdown / json */
    cozeResponseFormat: varchar('coze_response_format', { length: 32 }),
    /** 重复主题惩罚 */
    cozePresencePenalty: decimal('coze_presence_penalty', { precision: 4, scale: 3 }),
    /** 重复语句惩罚 */
    cozeFrequencyPenalty: decimal('coze_frequency_penalty', { precision: 4, scale: 3 }),
    /** model_info.parameters / cache_type / api_mode 等扩展参数 */
    cozeModelParameters: jsonb('coze_model_parameters').$type<Record<string, unknown>>(),
    /** 0 单 Agent；1 多 Agent */
    cozeBotMode: integer('coze_bot_mode'),
    /** text / voice / call */
    cozeDefaultUserInputType: varchar('coze_default_user_input_type', { length: 20 }),
    /** onboarding_info 完整对象（含兼容的 PascalCase 字段） */
    cozeOnboarding: jsonb('coze_onboarding').$type<Record<string, unknown>>(),
    /** 开场白（从 onboarding_info.prologue 提取） */
    cozePrologue: text('coze_prologue'),
    /** plugin_info_list */
    cozePlugins: jsonb('coze_plugins').$type<unknown[]>(),
    /** workflow_info_list */
    cozeWorkflows: jsonb('coze_workflows').$type<unknown[]>(),
    /** knowledge.knowledge_infos */
    cozeKnowledge: jsonb('coze_knowledge').$type<unknown[]>(),
    /** shortcut_commands */
    cozeShortcutCommands: jsonb('coze_shortcut_commands').$type<unknown[]>(),
    /** voice_info_list（兼容 voice_data_list） */
    cozeVoices: jsonb('coze_voices').$type<unknown[]>(),
    /** media_config */
    cozeMediaConfig: jsonb('coze_media_config').$type<Record<string, unknown>>(),
    /** background_image_info */
    cozeBackgroundImage: jsonb('coze_background_image').$type<Record<string, unknown>>(),
    /** suggest_reply_info */
    cozeSuggestReply: jsonb('coze_suggest_reply').$type<Record<string, unknown>>(),
    /** 所属 Coze 文件夹 */
    cozeFolderId: varchar('coze_folder_id', { length: 64 }),
    /** Coze 创建者用户 ID */
    cozeOwnerUserId: varchar('coze_owner_user_id', { length: 64 }),
    /** Coze 原始图标地址（签名 URL 会过期，只作溯源，不覆盖 avatar） */
    cozeIconUrl: text('coze_icon_url'),
    /** Coze 远端描述（与本地运营 description 解耦） */
    cozeDescription: text('coze_description'),
    /** Coze 创建/更新时间（Unix 秒） */
    cozeCreateTime: bigint('coze_create_time', { mode: 'number' }),
    cozeUpdateTime: bigint('coze_update_time', { mode: 'number' }),
    /** 完整原始 payload，未知字段也永久保留 */
    cozeConfigRaw: jsonb('coze_config_raw').$type<Record<string, unknown>>(),
    /** get_bot_config / get_online_info / legacy_cache */
    cozeConfigSource: varchar('coze_config_source', { length: 32 }),
    /** never / synced / partial / error / not_found / skipped_no_token */
    cozeConfigStatus: varchar('coze_config_status', { length: 20 }).default('never').notNull(),
    cozeConfigError: text('coze_config_error'),
    cozeConfigSyncedAt: timestamp('coze_config_synced_at', { withTimezone: true }),
    cozeConfigVersion: varchar('coze_config_version', { length: 64 }),
    cozeConfigHash: varchar('coze_config_hash', { length: 64 }),
    publishChannel: varchar('publish_channel', { length: 50 }),
    usageCount: bigint('usage_count', { mode: 'number' }).default(0).notNull(),
    likeCount: bigint('like_count', { mode: 'number' }).default(0).notNull(),
    shareCount: bigint('share_count', { mode: 'number' }).default(0).notNull(),
    collectCount: bigint('collect_count', { mode: 'number' }).default(0).notNull(),
    publishStatus: varchar('publish_status', { length: 20 }).default('published'),
    suggestedQuestions: text('suggested_questions'),
    cozeAccountId: varchar('coze_account_id', { length: 64 }),
    /** 智能体创建者用户名 (P0-5 补齐,冗余字段用于查询,避免 JOIN users 表) */
    userName: varchar('user_name', { length: 100 }),
  },
  (t) => ({
    userIdx: index('agents_user_idx').on(t.userId),
    categoryIdx: index('agents_category_idx').on(t.categoryId),
    statusIdx: index('agents_status_idx').on(t.status),
    cozeSyncIdx: index('agents_coze_sync_idx').on(t.cozeConfigStatus, t.cozeConfigSyncedAt),
  }),
)

/**
 * Coze BotInfo 每次拉取的全量快照。
 *
 * `agents.coze_config_raw` 只保留最新一版；本表按 `(agent_id, payload_hash)` 去重，
 * 保留每次版本变化的完整 payload，便于回溯 Coze 侧提示词/模型/插件/工作流/变量的历史差异。
 */
export const cozeBotSnapshots = pgTable(
  'coze_bot_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id').notNull(),
    botId: varchar('bot_id', { length: 64 }).notNull(),
    /** get_bot_config / get_online_info */
    source: varchar('source', { length: 32 }).notNull(),
    isPublished: boolean('is_published'),
    version: varchar('version', { length: 64 }),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentVersionIdx: uniqueIndex('coze_bot_snapshots_agent_hash_uniq').on(t.agentId, t.payloadHash),
    agentFetchedIdx: index('coze_bot_snapshots_agent_fetched_idx').on(t.agentId, t.fetchedAt),
  }),
)

export type CozeBotSnapshot = typeof cozeBotSnapshots.$inferSelect
export type NewCozeBotSnapshot = typeof cozeBotSnapshots.$inferInsert

/**
 * 智能体分类表。
 * status: '1'=启用 / '0'=禁用（沿用旧库 varchar(1) 约定）。
 * isPaid=true 表示该分类为付费分类。
 */
export const agentCategories = pgTable(
  'agent_categories',
  {
    categoryId: uuid('category_id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 100 }),
    sort: integer('sort').default(0).notNull(),
    status: varchar('status', { length: 1 }).default('1').notNull(),
    isPaid: boolean('is_paid').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('agent_categories_status_idx').on(t.status),
  }),
)

/**
 * 智能体结算记录表。
 * status: unsettled(未结算) / settled(已结算)。
 * commissionRate/commissionAmount: 佣金比例（百分比）与佣金金额（分）。
 */
export const agentSettlements = pgTable(
  'agent_settlements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id'),
    buyRecordId: uuid('buy_record_id'),
    orderNo: varchar('order_no', { length: 100 }),
    /** 结算账期(YYYY-MM)。与 orderNo 组成唯一键,保证同一订单每期只落一条。 */
    period: varchar('period', { length: 7 }),
    amount: integer('amount').default(0).notNull(),
    commissionRate: integer('commission_rate').default(0).notNull(),
    commissionAmount: integer('commission_amount').default(0).notNull(),
    status: varchar('status', { length: 20 }).default('unsettled').notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdx: index('agent_settlements_agent_idx').on(t.agentId),
    statusIdx: index('agent_settlements_status_idx').on(t.status),
    orderNoIdx: index('agent_settlements_order_no_idx').on(t.orderNo),
    orderPeriodUniq: uniqueIndex('agent_settlements_order_period_uniq').on(t.orderNo, t.period),
  }),
)

/**
 * 智能体审核记录表。
 * status: pending(待审核) / approved(已通过) / rejected(已驳回)。
 * reviewerId: 审核人 user id。reviewedAt: 审核时间。
 */
export const agentExamines = pgTable(
  'agent_examines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id'),
    userId: uuid('user_id'),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    reason: text('reason'),
    reviewerId: uuid('reviewer_id'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdx: index('agent_examines_agent_idx').on(t.agentId),
    statusIdx: index('agent_examines_status_idx').on(t.status),
    userIdx: index('agent_examines_user_idx').on(t.userId),
  }),
)

/**
 * 智能体热度统计表 (历史 agent_heat_stats)。
 * hitCount: 命中次数。dateStr: 日期字符串 YYYY-MM-DD。
 * P1-5 补齐: totalCalls/successCalls/failedCalls/avgDurationMs/lastCallAt 用于调用统计。
 */
export const agentHeatStats = pgTable(
  'agent_heat_stats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id').notNull(),
    hitCount: bigint('hit_count', { mode: 'number' }).default(0).notNull(),
    dateStr: varchar('date_str', { length: 10 }),
    /** 总调用次数 (P1-5 补齐) */
    totalCalls: bigint('total_calls', { mode: 'number' }).default(0).notNull(),
    /** 成功调用次数 (P1-5 补齐) */
    successCalls: bigint('success_calls', { mode: 'number' }).default(0).notNull(),
    /** 失败调用次数 (P1-5 补齐) */
    failedCalls: bigint('failed_calls', { mode: 'number' }).default(0).notNull(),
    /** 平均耗时(毫秒) (P1-5 补齐) */
    avgDurationMs: integer('avg_duration_ms'),
    /** 最后调用时间 (P1-5 补齐) */
    lastCallAt: timestamp('last_call_at', { withTimezone: true }),
    /** 95 百分位耗时(毫秒) (P2-11 补齐,审计 Medium) */
    p95DurationMs: integer('p95_duration_ms'),
    /** 错误率 0.0000-1.0000 (P2-11 补齐,审计 Medium) */
    errorRate: decimal('error_rate', { precision: 4, scale: 4 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdx: index('agent_heat_stats_agent_idx').on(t.agentId),
    dateStrIdx: index('agent_heat_stats_date_str_idx').on(t.dateStr),
    agentDateIdx: index('agent_heat_stats_agent_date_idx').on(t.agentId, t.dateStr),
    totalCallsIdx: index('agent_heat_stats_total_calls_idx').on(t.totalCalls),
    successCallsIdx: index('agent_heat_stats_success_calls_idx').on(t.successCalls),
    lastCallAtIdx: index('agent_heat_stats_last_call_at_idx').on(t.lastCallAt),
    agentLastCallAtIdx: index('agent_heat_stats_agent_last_call_at_idx').on(
      t.agentId,
      t.lastCallAt,
    ),
    agentDateUniq: unique('agent_heat_stats_agent_date_unique').on(t.agentId, t.dateStr),
  }),
)

/**
 * 智能体回调配置表 (历史 agent_callbacks)。
 * callbackUrl: 回调地址。callbackData1/2/3: 回调扩展数据。
 * P1-6 补齐: method/headers/timeout/retryCount/retryInterval/status/lastCallbackAt 用于回调执行控制。
 */
export const agentCallbacks = pgTable(
  'agent_callbacks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id').notNull(),
    callbackUrl: text('callback_url'),
    callbackData1: varchar('callback_data_1', { length: 500 }),
    callbackData2: varchar('callback_data_2', { length: 500 }),
    callbackData3: varchar('callback_data_3', { length: 500 }),
    /** HTTP 方法 GET/POST/PUT 等 (P1-6 补齐) */
    method: varchar('method', { length: 20 }),
    /** HTTP 请求头 JSON 文本 (P1-6 补齐) */
    headers: text('headers'),
    /** 超时时间(毫秒) (P1-6 补齐) */
    timeout: integer('timeout'),
    /** 重试次数 (P1-6 补齐) */
    retryCount: integer('retry_count'),
    /** 重试间隔(毫秒) (P1-6 补齐) */
    retryInterval: integer('retry_interval'),
    /** 状态 enabled/disabled (P1-6 补齐) */
    status: varchar('status', { length: 20 }),
    /** 最后回调时间 (P1-6 补齐) */
    lastCallbackAt: timestamp('last_callback_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdx: index('agent_callbacks_agent_idx').on(t.agentId),
  }),
)

/**
 * 智能体配置表 (历史 agent_configs)。
 * configKey/configValue: 键值对配置。isDeleted: 软删除标记。
 */
export const agentConfigs = pgTable(
  'agent_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id').notNull(),
    configKey: varchar('config_key', { length: 100 }).notNull(),
    configValue: text('config_value'),
    isDeleted: integer('is_deleted').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdx: index('agent_configs_agent_idx').on(t.agentId),
  }),
)

export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert
export type AgentCategory = typeof agentCategories.$inferSelect
export type NewAgentCategory = typeof agentCategories.$inferInsert
export type AgentSettlement = typeof agentSettlements.$inferSelect
export type NewAgentSettlement = typeof agentSettlements.$inferInsert
export type AgentExamine = typeof agentExamines.$inferSelect
export type NewAgentExamine = typeof agentExamines.$inferInsert
export type AgentHeatStats = typeof agentHeatStats.$inferSelect
export type NewAgentHeatStats = typeof agentHeatStats.$inferInsert
export type AgentCallback = typeof agentCallbacks.$inferSelect
export type NewAgentCallback = typeof agentCallbacks.$inferInsert
export type AgentConfig = typeof agentConfigs.$inferSelect
export type NewAgentConfig = typeof agentConfigs.$inferInsert

/**
 * 智能体分类关联表 (agent_category_links)。
 * Agent 与分类的多对多关联。
 * isPrimary=true 表示为主分类。
 */

export const agentThumbs = pgTable(
  'zhs_agent_thumbs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    uuid: varchar('uuid', { length: 64 }).notNull(),
    botId: varchar('bot_id', { length: 64 }).notNull(),
    thumbsTime: timestamp('thumbs_time', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uuidBotIdx: index('zhs_agent_thumbs_uuid_bot_idx').on(t.uuid, t.botId),
  }),
)

export const agentCollects = pgTable(
  'zhs_agent_collect',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    uuid: varchar('uuid', { length: 64 }).notNull(),
    botId: varchar('bot_id', { length: 64 }).notNull(),
    collectTime: timestamp('collect_time', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uuidBotIdx: index('zhs_agent_collect_uuid_bot_idx').on(t.uuid, t.botId),
  }),
)

export const agentUseDetails = pgTable(
  'zhs_agent_useDetail',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    uuid: varchar('uuid', { length: 64 }).notNull(),
    botId: varchar('bot_id', { length: 64 }).notNull(),
    lastTime: timestamp('last_time', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uuidBotIdx: index('zhs_agent_useDetail_uuid_bot_idx').on(t.uuid, t.botId),
  }),
)

export type AgentThumb = typeof agentThumbs.$inferSelect
export type NewAgentThumb = typeof agentThumbs.$inferInsert
export type AgentCollect = typeof agentCollects.$inferSelect
export type NewAgentCollect = typeof agentCollects.$inferInsert
export type AgentUseDetail = typeof agentUseDetails.$inferSelect
export type NewAgentUseDetail = typeof agentUseDetails.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
