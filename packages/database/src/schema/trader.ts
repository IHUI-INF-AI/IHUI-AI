import { pgTable, uuid, varchar, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 交易员表。
 * status: 'pending'(申请中) / 'approved'(已通过) / 'rejected'(已驳回) / 'banned'(已封禁)。
 * commission_rate: 佣金比例（百分比，0-100）。
 * performance: 业绩统计（jsonb，如胜率/收益率等，由业务定义结构）。
 * specialties: 专长标签（jsonb 数组）。
 */
export const traders = pgTable(
  'traders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    commissionRate: integer('commission_rate').default(0).notNull(),
    performance: jsonb('performance').notNull().default({}),
    specialties: jsonb('specialties').notNull().default([]),
    intro: varchar('intro', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('traders_status_idx').on(t.status),
  }),
)

export type Trader = typeof traders.$inferSelect
export type NewTrader = typeof traders.$inferInsert
