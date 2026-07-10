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
} from 'drizzle-orm/pg-core';

/**
 * 智能体（Agent）主表。
 * status: pending(待审核) / published(已发布) / rejected(已驳回) / offline(已下架)。
 * isFree=true 时为免费智能体，price 字段忽略。
 * workspaceId 关联工作空间（外部约定，非 DB 外键）。
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
    sort: integer('sort').default(0).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    remark: text('remark'),
  },
  (t) => ({
    userIdx: index('agents_user_idx').on(t.userId),
    categoryIdx: index('agents_category_idx').on(t.categoryId),
    statusIdx: index('agents_status_idx').on(t.status),
  }),
);

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
);

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
);

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
);

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
);

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
);

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
);

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentCategory = typeof agentCategories.$inferSelect;
export type NewAgentCategory = typeof agentCategories.$inferInsert;
export type AgentSettlement = typeof agentSettlements.$inferSelect;
export type NewAgentSettlement = typeof agentSettlements.$inferInsert;
export type AgentExamine = typeof agentExamines.$inferSelect;
export type NewAgentExamine = typeof agentExamines.$inferInsert;
export type AgentHeatStats = typeof agentHeatStats.$inferSelect;
export type NewAgentHeatStats = typeof agentHeatStats.$inferInsert;
export type AgentCallback = typeof agentCallbacks.$inferSelect;
export type NewAgentCallback = typeof agentCallbacks.$inferInsert;
export type AgentConfig = typeof agentConfigs.$inferSelect;
export type NewAgentConfig = typeof agentConfigs.$inferInsert;
