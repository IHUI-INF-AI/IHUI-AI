import { pgTable, uuid, varchar, integer, timestamp, text, boolean, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';

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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 订单表。
 * amount 以分为单位。status: pending|paid|cancelled|refunded。
 * user_id 级联删除；plan_id 默认 NO ACTION（有订单时禁止删除方案）。
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
  paidAt: timestamp('paid_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

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
});

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
