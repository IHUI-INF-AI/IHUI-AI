import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  date,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core'

/**
 * 基金表 - 基金基础信息,按 code 唯一。
 */
export const funds = pgTable(
  'funds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    type: varchar('type', { length: 50 }),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeUniq: unique('uq_funds_code').on(t.code),
  }),
)

/**
 * 基金净值表 - 每日净值快照,关联 funds。
 */
export const fundNetValues = pgTable(
  'fund_net_values',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fundId: uuid('fund_id')
      .notNull()
      .references(() => funds.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    value: numeric('value', { precision: 10, scale: 4 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    fundIdx: index('ix_fund_net_values_fund').on(t.fundId),
  }),
)

export type Fund = typeof funds.$inferSelect
export type NewFund = typeof funds.$inferInsert
export type FundNetValue = typeof fundNetValues.$inferSelect
export type NewFundNetValue = typeof fundNetValues.$inferInsert
