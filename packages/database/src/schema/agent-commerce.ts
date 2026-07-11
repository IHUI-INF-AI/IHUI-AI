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
    status: varchar('status', { length: 32 }).default('pending').notNull(), // pending/completed/rejected
    bankInfo: text('bank_info'),
    rejectReason: text('reject_reason'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('zhs_agent_withdrawal_user_idx').on(t.userId),
    statusIdx: index('zhs_agent_withdrawal_status_idx').on(t.status),
  }),
)

export type ZhsAgentBuy = typeof zhsAgentBuy.$inferSelect
export type NewZhsAgentBuy = typeof zhsAgentBuy.$inferInsert
export type ZhsAgentWithdrawalDetail = typeof zhsAgentWithdrawalDetail.$inferSelect
export type NewZhsAgentWithdrawalDetail = typeof zhsAgentWithdrawalDetail.$inferInsert
