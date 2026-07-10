import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
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

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentCategory = typeof agentCategories.$inferSelect;
export type NewAgentCategory = typeof agentCategories.$inferInsert;
export type AgentSettlement = typeof agentSettlements.$inferSelect;
export type NewAgentSettlement = typeof agentSettlements.$inferInsert;
export type AgentExamine = typeof agentExamines.$inferSelect;
export type NewAgentExamine = typeof agentExamines.$inferInsert;
