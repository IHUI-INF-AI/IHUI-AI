import { pgTable, uuid, varchar, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { orders } from './billing.js'

/**
 * VIP 等级表。
 * price 以分为单位。durationDays: 有效天数。benefits: 权益列表（jsonb）。
 * status: 1=上架 0=下架
 * levelValue: 0=免费 1=个人 2=团队 3=企业(2026-07-28 P0-2a 扩展为 4 档)
 *
 * 配额字段(P0-2a 新增,plan-driven 中间件 P0-2b 读取):
 * - aiBudgetDefaults: 该档位默认 AI 预算 {dailyTokenLimit, monthlyTokenLimit, dailyCostLimit, monthlyCostLimit}
 * - apiQps: API 每秒查询限制(0=不限)
 * - maxConcurrency: 最大并发请求数(0=不限)
 * - modelWhitelist: 允许的模型 ID 数组(null=全部允许,[]=无权限)
 */
export const vipLevels = pgTable(
  'vip_levels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    levelName: varchar('level_name', { length: 100 }).notNull(),
    levelValue: integer('level_value').default(0).notNull(), // 0=免费 1=个人 2=团队 3=企业
    price: integer('price').default(0).notNull(),
    durationDays: integer('duration_days').default(30).notNull(),
    benefits: jsonb('benefits').notNull().default([]),
    status: integer('status').default(1).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    // P0-2a 配额字段(2026-07-28)
    aiBudgetDefaults: jsonb('ai_budget_defaults').notNull().default({
      dailyTokenLimit: 100_000,
      monthlyTokenLimit: 1_000_000,
      dailyCostLimit: '10',
      monthlyCostLimit: '100',
    }),
    apiQps: integer('api_qps').default(10).notNull(),
    maxConcurrency: integer('max_concurrency').default(3).notNull(),
    modelWhitelist: jsonb('model_whitelist'), // null=全部允许
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('vip_levels_status_idx').on(t.status),
  }),
)

/**
 * 用户 VIP 订阅记录表。
 * status: 0=过期 1=生效 2=已取消
 * autoRenew: 是否自动续费（0=否 1=是）
 */
export const userVips = pgTable(
  'user_vips',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    vipLevelId: uuid('vip_level_id').references(() => vipLevels.id, { onDelete: 'set null' }),
    levelValue: integer('level_value').default(0).notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    status: integer('status').default(1).notNull(),
    autoRenew: integer('auto_renew').default(0).notNull(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_vips_user_idx').on(t.userId),
    statusIdx: index('user_vips_status_idx').on(t.status),
  }),
)

export type VipLevel = typeof vipLevels.$inferSelect
export type NewVipLevel = typeof vipLevels.$inferInsert
export type UserVip = typeof userVips.$inferSelect
export type NewUserVip = typeof userVips.$inferInsert
