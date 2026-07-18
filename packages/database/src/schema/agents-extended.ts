import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  bigint,
  integer,
  timestamp,
  index,
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
    // Coze 配置字段（H-3 补齐，等价自旧架构 agent_models.py）
    agentVersion: varchar('agent_version', { length: 32 }),
    botId: varchar('bot_id', { length: 64 }),
    botIdStr: varchar('bot_id_str', { length: 64 }),
    botName: varchar('bot_name', { length: 200 }),
    agentPrompt: text('agent_prompt'),
    agentModel: varchar('agent_model', { length: 100 }),
    agentTemperature: integer('agent_temperature'),
    agentMaxTokens: integer('agent_max_tokens'),
    agentVariables: text('agent_variables'),
    publishChannel: varchar('publish_channel', { length: 50 }),
    usageCount: bigint('usage_count', { mode: 'number' }).default(0).notNull(),
    likeCount: bigint('like_count', { mode: 'number' }).default(0).notNull(),
    shareCount: bigint('share_count', { mode: 'number' }).default(0).notNull(),
    collectCount: bigint('collect_count', { mode: 'number' }).default(0).notNull(),
    publishStatus: varchar('publish_status', { length: 20 }).default('published'),
    suggestedQuestions: text('suggested_questions'),
    cozeAccountId: varchar('coze_account_id', { length: 64 }),
  },
  (t) => ({
    userIdx: index('agents_user_idx').on(t.userId),
    categoryIdx: index('agents_category_idx').on(t.categoryId),
    statusIdx: index('agents_status_idx').on(t.status),
  }),
)

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
 */
export const agentHeatStats = pgTable(
  'agent_heat_stats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id').notNull(),
    hitCount: bigint('hit_count', { mode: 'number' }).default(0).notNull(),
    dateStr: varchar('date_str', { length: 10 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdx: index('agent_heat_stats_agent_idx').on(t.agentId),
  }),
)

/**
 * 智能体回调配置表 (历史 agent_callbacks)。
 * callbackUrl: 回调地址。callbackData1/2/3: 回调扩展数据。
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
export const agentCategoryLink = pgTable(
  'agent_category_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id').references(() => agents.agentId, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => agentCategories.categoryId, {
      onDelete: 'cascade',
    }),
    isPrimary: boolean('is_primary').default(false),
    sort: integer('sort').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdIdx: index('agent_category_links_agent_idx').on(t.agentId),
    categoryIdIdx: index('agent_category_links_category_idx').on(t.categoryId),
  }),
)

export type AgentCategoryLink = typeof agentCategoryLink.$inferSelect
export type NewAgentCategoryLink = typeof agentCategoryLink.$inferInsert

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
