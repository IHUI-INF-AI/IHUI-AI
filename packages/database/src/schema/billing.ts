import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 订阅方案表。
 * price 以分为单位（integer），避免浮点误差。
 * interval: 'month' | 'year'。features: 方案权益列表（jsonb）。
 */
export const plans = pgTable('plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  description: text('description'),
  price: integer('price').notNull(),
  interval: varchar('interval', { length: 16 }).notNull(),
  features: jsonb('features').notNull().default([]),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  wechatPlanId: varchar('wechat_plan_id', { length: 64 }),
  billingPeriod: varchar('billing_period', { length: 20 }).default('month').notNull(),
  trialDays: integer('trial_days').default(0).notNull(),
  isRecurring: boolean('is_recurring').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 订单表。
 * amount 以分为单位。status: pending|paid|cancelled|refunded。
 * user_id 级联删除；plan_id 默认 NO ACTION（有订单时禁止删除方案）。
 * orderType: 1=membership 2=token 3=activity 4=identity（0=未分类）。
 */
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNo: varchar('order_no', { length: 64 }).notNull().unique(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  planId: uuid('plan_id').references(() => plans.id),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 8 }).default('CNY').notNull(),
  status: varchar('status', { length: 16 }).default('pending').notNull(),
  paymentMethod: varchar('payment_method', { length: 16 }),
  orderType: integer('order_type').default(0).notNull(),
  productId: varchar('product_id', { length: 64 }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 支付记录表。
 * provider: wechat|alipay|stripe|usdc。status: pending|success|failed。
 * order_id 级联删除；raw_response 为网关原始响应（不含敏感信息时不返回）。
 */
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  provider: varchar('provider', { length: 16 }).notNull(),
  providerOrderId: varchar('provider_order_id', { length: 128 }),
  amount: integer('amount').notNull(),
  status: varchar('status', { length: 16 }).default('pending').notNull(),
  rawResponse: jsonb('raw_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Plan = typeof plans.$inferSelect
export type NewPlan = typeof plans.$inferInsert
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert

/**
 * AI 模型定价表（ai_pricing）。
 * - modelId: 模型标识（对应 ai_model_config.name 与 ai_cost_records.model，按模型名匹配定价）。
 * - inputTokenPrice/outputTokenPrice: 输入/输出 token 单价，单位"分/千 token"（整数，避免浮点误差）。
 * - regionPricing: 区域差价系数 JSON，如 { "cn": 1.0, "us": 1.2, "eu": 1.15 }。
 * - discount: 折扣规则 JSON，如 { "type": "percentage", "value": 0.8, "minTokens": 100000 }。
 * - currency: 货币类型，默认 CNY。
 * - effectiveAt/expiresAt: 生效/过期时间，用于支持定价版本管理。
 */
export const aiPricing = pgTable(
  'ai_pricing',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    modelId: varchar('model_id', { length: 128 }).notNull(),
    inputTokenPrice: integer('input_token_price').notNull(),
    outputTokenPrice: integer('output_token_price').notNull(),
    regionPricing: jsonb('region_pricing').notNull().default({ cn: 1.0 }),
    discount: jsonb('discount'),
    currency: varchar('currency', { length: 8 }).default('CNY').notNull(),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    modelIdx: index('ai_pricing_model_idx').on(t.modelId),
    effectiveIdx: index('ai_pricing_effective_idx').on(t.effectiveAt),
  }),
)

export type AiPricing = typeof aiPricing.$inferSelect
export type NewAiPricing = typeof aiPricing.$inferInsert
