import {
  pgTable,
  serial,
  varchar,
  integer,
  uuid,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { plans } from './billing.js'
import { zhsProduct } from './zhs-full.js'

/**
 * 微信支付周期扣款签约记录表。
 * - contractId: 微信签约协议号（微信侧返回的 plan_id+contract_id），唯一。
 * - status: pending/active/cancelled/expired。
 * - lastChargeStatus: success/failed/pending。
 * - planId / productId 二选一：会员级签约填 planId，商品级签约填 productId。
 * - nextChargeTime 索引用于定时扣款扫描。
 */
export const wechatPayContracts = pgTable(
  'wechat_pay_contracts',
  {
    id: serial('id').primaryKey(),
    contractId: varchar('contract_id', { length: 64 }).notNull().unique(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    planId: uuid('plan_id').references(() => plans.id),
    productId: integer('product_id').references(() => zhsProduct.id),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    wechatPlanId: varchar('wechat_plan_id', { length: 64 }),
    outTradeNo: varchar('out_trade_no', { length: 64 }),
    nextChargeTime: timestamp('next_charge_time', { withTimezone: true }),
    lastChargeTime: timestamp('last_charge_time', { withTimezone: true }),
    lastChargeStatus: varchar('last_charge_status', { length: 20 }),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: varchar('cancel_reason', { length: 500 }),
    trialEndAt: timestamp('trial_end_at', { withTimezone: true }),
    rawResponse: jsonb('raw_response'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('wechat_pay_contracts_user_id_idx').on(t.userId),
    statusIdx: index('wechat_pay_contracts_status_idx').on(t.status),
    nextChargeTimeIdx: index('wechat_pay_contracts_next_charge_time_idx').on(t.nextChargeTime),
  }),
)

export type WechatPayContract = typeof wechatPayContracts.$inferSelect
export type NewWechatPayContract = typeof wechatPayContracts.$inferInsert
