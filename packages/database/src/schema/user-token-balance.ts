import { pgTable, varchar, numeric, timestamp } from 'drizzle-orm/pg-core'

/**
 * 用户 Token 余额表。
 *
 * 历史:apps/api 代码(agents.ts / miniapp-compat-routes.ts)直接 SQL 引用此表,
 * 但 TS schema 与 migration 从未定义,导致运行时 500 "关系 user_token_balance 不存在"。
 * 2026-08-04 补建,字段对齐 SQL 查询:
 *   - user_uuid 主键(与 users.id UUID 一致)
 *   - balance / frozen_balance 用 numeric(20,4) 支持积分小数
 *   - updated_at 由应用层维护(代码用 updated_at = now())
 */
export const userTokenBalance = pgTable('user_token_balance', {
  userUuid: varchar('user_uuid', { length: 64 }).primaryKey(),
  balance: numeric('balance', { precision: 20, scale: 4 }).default('0').notNull(),
  frozenBalance: numeric('frozen_balance', { precision: 20, scale: 4 }).default('0').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type UserTokenBalance = typeof userTokenBalance.$inferSelect
export type NewUserTokenBalance = typeof userTokenBalance.$inferInsert
