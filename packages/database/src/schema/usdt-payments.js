import { pgTable, serial, uuid, varchar, decimal, integer, timestamp, jsonb, index, } from 'drizzle-orm/pg-core';
import { users } from './users.js';
/**
 * USDT 加密货币支付网关表(2026-08-01 立,TRC20/ERC20 充值订单 + 区块链到账确认 + 钱包入账)。
 *
 * - orderNo: 平台内部订单号(唯一),关联充值流程
 * - network: TRC20 / ERC20
 * - amount: USDT 金额(精度 18 位)
 * - txHash: 区块链交易哈希(到账确认后回填)
 * - status: pending / confirmed / failed / expired
 * - fromAddress / toAddress: 链上转账地址
 * - confirmations: 区块确认数(TRC20 ≥20 / ERC20 ≥12 视为最终确认)
 * - creditedAt: 钱包入账时间(确认后写入)
 *
 * 占位实现(2026-07-31):其他 agent 引用了本文件但未创建,此处补全表定义让 api 可启动。
 * 后续可按需扩展字段或新增 migration。
 */
export const usdtPayments = pgTable('usdt_payments', {
    id: serial('id').primaryKey(),
    orderNo: varchar('order_no', { length: 64 }).notNull().unique(),
    userId: uuid('user_id')
        .references(() => users.id, { onDelete: 'cascade' })
        .notNull(),
    network: varchar('network', { length: 10 }).notNull(),
    amount: decimal('amount', { precision: 18, scale: 8 }).notNull(),
    fromAddress: varchar('from_address', { length: 64 }),
    toAddress: varchar('to_address', { length: 64 }).notNull(),
    txHash: varchar('tx_hash', { length: 80 }),
    confirmations: integer('confirmations').default(0).notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    creditedAt: timestamp('credited_at', { withTimezone: true }),
    expiredAt: timestamp('expired_at', { withTimezone: true }),
}, (t) => ({
    userIdx: index('usdt_payments_user_id_idx').on(t.userId),
    statusIdx: index('usdt_payments_status_idx').on(t.status),
    txHashIdx: index('usdt_payments_tx_hash_idx').on(t.txHash),
}));
//# sourceMappingURL=usdt-payments.js.map