import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  doublePrecision,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

// ═══════════════════════════════════════════════════════════════════════
// 运营控制台模块表(2026-09-17 立,4-4-12):lottery / points-mall / promotion-rules / tax
// 前端管理页(admin/lottery|points-mall|promotion-rule|tax)为列表管理壳,
// 本组表按其既有契约精确建表,CRUD 经 registerCrud 统一暴露于 /api/admin/*。
// prizes 用 JSONB(管理端配置展示;真实抽奖引擎上线时再拆 prizes 表,避免过早建模)。
// ═══════════════════════════════════════════════════════════════════════

/** 抽奖奖品(嵌入 lotteries.prizes) */
export interface LotteryPrize {
  id: string
  name: string
  level: 'first' | 'second' | 'third' | 'normal'
  total: number
  weight: number
  remaining: number
}

export type LotteryStatus = 'draft' | 'active' | 'finished' | 'cancelled'
export type PointsProductStatus = 'on' | 'off' | 'soldout'
export type PromotionRuleStatus = 'draft' | 'active' | 'paused' | 'expired'
export type TaxRuleStatus = 'active' | 'disabled'

/** 抽奖活动 */
export const lotteries = pgTable(
  'lotteries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    cover: text('cover'),
    costPoints: integer('cost_points').default(0).notNull(),
    freeQuota: integer('free_quota').default(0).notNull(),
    prizes: jsonb('prizes').$type<LotteryPrize[]>().default([]).notNull(),
    participants: integer('participants').default(0).notNull(),
    winners: integer('winners').default(0).notNull(),
    status: varchar('status', { length: 16 }).default('draft').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_lotteries_status').on(t.status),
    nameIdx: index('ix_lotteries_name').on(t.name),
  }),
)

/** 积分商城商品 */
export const pointsMallProducts = pgTable(
  'points_mall_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    cover: text('cover'),
    category: varchar('category', { length: 16 }).default('virtual').notNull(),
    pointsCost: integer('points_cost').default(0).notNull(),
    stock: integer('stock').default(0).notNull(),
    sold: integer('sold').default(0).notNull(),
    limitPerUser: integer('limit_per_user').default(0).notNull(),
    status: varchar('status', { length: 16 }).default('on').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_points_mall_status').on(t.status),
    nameIdx: index('ix_points_mall_name').on(t.name),
  }),
)

/** 促销规则 */
export const promotionRules = pgTable(
  'promotion_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    type: varchar('type', { length: 16 }).default('discount').notNull(),
    threshold: doublePrecision('threshold').default(0).notNull(),
    discount: doublePrecision('discount').default(0).notNull(),
    discountType: varchar('discount_type', { length: 8 }).default('amount').notNull(),
    scope: varchar('scope', { length: 16 }).default('all').notNull(),
    scopeRef: text('scope_ref'),
    priority: integer('priority').default(0).notNull(),
    status: varchar('status', { length: 16 }).default('draft').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_promotion_rules_status').on(t.status),
    nameIdx: index('ix_promotion_rules_name').on(t.name),
  }),
)

/** 税率规则 */
export const billingTaxRates = pgTable(
  'billing_tax_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    category: varchar('category', { length: 64 }).default('default').notNull(),
    rate: doublePrecision('rate').default(0).notNull(),
    threshold: doublePrecision('threshold').default(0).notNull(),
    description: text('description'),
    status: varchar('status', { length: 16 }).default('active').notNull(),
    effectiveAt: timestamp('effective_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_billing_tax_status').on(t.status),
    nameIdx: index('ix_billing_tax_name').on(t.name),
  }),
)

export type Lottery = typeof lotteries.$inferSelect
export type NewLottery = typeof lotteries.$inferInsert
export type PointsMallProduct = typeof pointsMallProducts.$inferSelect
export type NewPointsMallProduct = typeof pointsMallProducts.$inferInsert
export type PromotionRuleRow = typeof promotionRules.$inferSelect
export type NewPromotionRuleRow = typeof promotionRules.$inferInsert
export type BillingTaxRate = typeof billingTaxRates.$inferSelect
export type NewBillingTaxRate = typeof billingTaxRates.$inferInsert
