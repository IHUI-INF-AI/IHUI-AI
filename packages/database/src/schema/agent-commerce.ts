import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

// 智能体购买记录表
export const zhsAgentBuy = pgTable(
  'zhs_agent_buy',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id').notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    duration: integer('duration').notNull(), // 购买时长（天）
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 32 }).default('pending').notNull(), // pending/active/expired/cancelled
    paymentMethod: varchar('payment_method', { length: 32 }),
    paymentId: varchar('payment_id', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdx: index('zhs_agent_buy_agent_idx').on(t.agentId),
    userIdx: index('zhs_agent_buy_user_idx').on(t.userId),
    statusIdx: index('zhs_agent_buy_status_idx').on(t.status),
  }),
)

// 智能体提现明细表
export const zhsAgentWithdrawalDetail = pgTable(
  'zhs_agent_withdrawal_detail',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    agentId: uuid('agent_id'),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    status: varchar('status', { length: 32 }).default('pending').notNull(), // pending/approved/processing/completed/rejected/failed
    type: integer('type'), // 提现方式: 1=微信 2=支付宝 3=其他
    outBillNo: varchar('out_bill_no', { length: 255 }), // 提现订单号
    orderIds: text('order_ids'), // 关联的结算记录 ID,逗号分隔
    reviewer: uuid('reviewer'), // 审核人 ID
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }), // 审核时间
    initiateAt: timestamp('initiate_at', { withTimezone: true }), // 发起时间
    bankInfo: text('bank_info'),
    rejectReason: text('reject_reason'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('zhs_agent_withdrawal_user_idx').on(t.userId),
    statusIdx: index('zhs_agent_withdrawal_status_idx').on(t.status),
    outBillNoIdx: index('zhs_agent_withdrawal_out_bill_no_idx').on(t.outBillNo),
  }),
)

export type ZhsAgentBuy = typeof zhsAgentBuy.$inferSelect
export type NewZhsAgentBuy = typeof zhsAgentBuy.$inferInsert
export type ZhsAgentWithdrawalDetail = typeof zhsAgentWithdrawalDetail.$inferSelect
export type NewZhsAgentWithdrawalDetail = typeof zhsAgentWithdrawalDetail.$inferInsert

/**
 * 智能体购买定时任务表 - 定时检查购买过期并更新状态。
 * 注: buyId 软引用 zhsAgentBuy.id,不建物理外键(避免 migration 顺序依赖)
 */
export const agentBuyScheduledTasks = pgTable(
  'agent_buy_scheduled_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    buyId: uuid('buy_id').notNull(),
    taskType: varchar('task_type', { length: 32 }).default('expiry_check').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    status: varchar('status', { length: 32 }).default('pending').notNull(),
    result: text('result'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    buyIdx: index('agent_buy_scheduled_buy_idx').on(t.buyId),
    statusIdx: index('agent_buy_scheduled_status_idx').on(t.status),
  }),
)

export type AgentBuyScheduledTask = typeof agentBuyScheduledTasks.$inferSelect
export type NewAgentBuyScheduledTask = typeof agentBuyScheduledTasks.$inferInsert
