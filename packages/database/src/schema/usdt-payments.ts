import { pgTable, uuid, text, numeric, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * USDT 加密货币支付网关表(2026-08-01 立,TRC20/ERC20 充值订单 + 区块链到账确认 + 钱包入账)。
 *
 * 以 apps/api/src/services/payment-usdt-service.ts 代码为准:
 * - orderId: 平台内部订单号(唯一),格式 USDT + 时间戳 + 随机后缀
 * - userId: 发起充值的用户(级联删除)
 * - address: 充值目标地址(TRC20/ERC20 链上地址,从 env 读取)
 * - network: 链网络(TRC20 / ERC20)
 * - amount: 应收 USDT 数量(numeric(20,8),8 位小数精度,drizzle 默认 string)
 * - amountPaid: 实际到账 USDT 数量(确认时回写,默认 0)
 * - txHash: 链上交易哈希(确认时回写)
 * - status: pending=待支付 / confirmed=已确认到账 / expired=已过期
 * - expiresAt: 订单过期时间(默认创建后 30 分钟)
 * - createdAt: 订单创建时间
 * - confirmedAt: 确认到账时间(确认时回写)
 *
 * 对应 migration:drizzle/20260801010030_add_usdt_payments_table.sql
 */
export const usdtPayments = pgTable(
  'usdt_payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: text('order_id').notNull().unique(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    address: text('address').notNull(),
    network: text('network').notNull(),
    amount: numeric('amount', { precision: 20, scale: 8 }).notNull(),
    amountPaid: numeric('amount_paid', { precision: 20, scale: 8 }).default('0').notNull(),
    txHash: text('tx_hash'),
    status: text('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('usdt_payments_user_id_idx').on(t.userId),
    statusIdx: index('usdt_payments_status_idx').on(t.status),
    addressIdx: index('usdt_payments_address_idx').on(t.address),
  }),
)

export type UsdtPayment = typeof usdtPayments.$inferSelect
export type NewUsdtPayment = typeof usdtPayments.$inferInsert
