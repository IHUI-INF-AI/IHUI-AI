import { pgTable, uuid, varchar, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { orders } from './billing.js';

/**
 * 佣金流水表。
 * 语义澄清（修正旧架构 user_id 语义混乱）：
 * - beneficiaryId = 获佣人（推荐人，佣金计入此账户，可空：用户删除时保留佣金凭证，beneficiaryId 置 NULL）
 * - invitedUserId = 下单人（被邀请人，产生订单的用户）
 * - orderId = 关联订单
 * type: 0=regular 1=vip 2=trader(祖父级)
 * status: 0=invalid 1=active
 */
export const commissionFlows = pgTable(
  'commission_flows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    beneficiaryId: uuid('beneficiary_id').references(() => users.id, { onDelete: 'set null' }),
    invitedUserId: uuid('invited_user_id')
      .references(() => users.id, { onDelete: 'set null' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    amount: integer('amount').default(0).notNull(), // 佣金金额（分）
    token: integer('token').default(0).notNull(), // 赚取 token
    type: integer('type').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    remark: varchar('remark', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    beneficiaryIdx: index('commission_flows_beneficiary_idx').on(t.beneficiaryId),
    invitedIdx: index('commission_flows_invited_idx').on(t.invitedUserId),
    statusIdx: index('commission_flows_status_idx').on(t.status),
  }),
);

/**
 * 提现流水表。
 * status: 0=pending 1=processing 2=completed 3=failed
 * method: wechat | alipay | bank
 * accountInfo: jsonb（微信/支付宝账号、银行卡号、姓名等）
 * userId 可空：用户删除时保留提现财务凭证，userId 置 NULL。
 */
export const withdrawalFlows = pgTable(
  'withdrawal_flows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    amount: integer('amount').notNull(), // 实际到账金额（已扣手续费，分）
    fee: integer('fee').default(0).notNull(), // 手续费（分）
    originalAmount: integer('original_amount').notNull(), // 原始申请金额（分）
    status: integer('status').default(0).notNull(),
    method: varchar('method', { length: 16 }).notNull(),
    accountInfo: jsonb('account_info'),
    partnerTradeNo: varchar('partner_trade_no', { length: 64 }),
    paymentNo: varchar('payment_no', { length: 64 }),
    rejectReason: varchar('reject_reason', { length: 500 }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('withdrawal_flows_user_idx').on(t.userId),
    statusIdx: index('withdrawal_flows_status_idx').on(t.status),
  }),
);

/**
 * 分销比例配置表。
 * status: 0=stopped 1=active（同一时间仅一条 active）
 * 各 proportion 字段为百分比 0-100。
 */
export const identityProportions = pgTable('identity_proportions', {
  id: uuid('id').defaultRandom().primaryKey(),
  beginTime: timestamp('begin_time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }),
  status: integer('status').default(0).notNull(),
  // 普通用户邀请奖励
  gift: integer('gift').default(0).notNull(),
  tokenProportion: integer('token_proportion').default(0).notNull(),
  // VIP 邀请奖励
  vipGift: integer('vip_gift').default(0).notNull(),
  routineProportion: integer('routine_proportion').default(0).notNull(), // VIP→常规订单 %
  vipProportion: integer('vip_proportion').default(0).notNull(), // VIP→VIP 订单 %
  // 操盘手邀请奖励
  traderProportion: integer('trader_proportion').default(0).notNull(),
  traderGift: integer('trader_gift').default(0).notNull(),
  traderRoutineProportion: integer('trader_routine_proportion').default(0).notNull(),
  traderVipProportion: integer('trader_vip_proportion').default(0).notNull(),
  traderTraderProportion: integer('trader_trader_proportion').default(0).notNull(),
  // 祖父级（操盘手的上级）
  grandRoutineProportion: integer('grand_routine_proportion').default(0).notNull(),
  grandVipProportion: integer('grand_vip_proportion').default(0).notNull(),
  grandTraderProportion: integer('grand_trader_proportion').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CommissionFlow = typeof commissionFlows.$inferSelect;
export type NewCommissionFlow = typeof commissionFlows.$inferInsert;
export type WithdrawalFlow = typeof withdrawalFlows.$inferSelect;
export type NewWithdrawalFlow = typeof withdrawalFlows.$inferInsert;
export type IdentityProportion = typeof identityProportions.$inferSelect;
export type NewIdentityProportion = typeof identityProportions.$inferInsert;
