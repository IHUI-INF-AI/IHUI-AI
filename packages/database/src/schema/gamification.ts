import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  date,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 用户积分表。
 * 每个用户一行（user_id 唯一）。points 为当前可消费余额；
 * total_earned / total_spent 为累计获得/消费；experience 为经验值（仅 earn 增长，spend 不减）。
 */
export const userPoints = pgTable('user_points', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  points: integer('points').default(0).notNull(),
  totalEarned: integer('total_earned').default(0).notNull(),
  totalSpent: integer('total_spent').default(0).notNull(),
  level: integer('level').default(1).notNull(),
  experience: integer('experience').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 积分流水表。
 * type: 'earn' | 'spend'。amount 正数 earn / 负数 spend。
 * balance_after 记录操作后余额；source 标识来源；reference_id 关联资源（如签到记录 id）。
 */
export const pointTransactions = pgTable('point_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  type: varchar('type', { length: 16 }).notNull(),
  source: varchar('source', { length: 32 }).notNull(),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  description: varchar('description', { length: 255 }),
  referenceId: varchar('reference_id', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 签到记录表。
 * (user_id, sign_in_date) 联合唯一：同一用户同一天仅一条。
 * consecutive_days 连续签到天数；reward_points 奖励积分。
 */
export const signInRecords = pgTable(
  'sign_in_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    signInDate: date('sign_in_date').notNull(),
    consecutiveDays: integer('consecutive_days').default(1).notNull(),
    rewardPoints: integer('reward_points').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userDateUnique: unique().on(t.userId, t.signInDate),
  }),
)

/**
 * 等级定义表。
 * level 唯一。min_experience / max_experience 定义经验区间。
 * benefits 为等级权益（jsonb，结构由业务定义）。
 */
export const levels = pgTable('levels', {
  id: uuid('id').defaultRandom().primaryKey(),
  level: integer('level').notNull().unique(),
  name: varchar('name', { length: 64 }).notNull(),
  minExperience: integer('min_experience').notNull(),
  maxExperience: integer('max_experience').notNull(),
  icon: varchar('icon', { length: 512 }),
  benefits: jsonb('benefits').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 签到规则配置表。
 * 定义签到奖励规则：连续天数阈值 + 奖励积分 + 额外奖励。
 */
export const signInRules = pgTable('sign_in_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  consecutiveDays: integer('consecutive_days').notNull(), // 连续签到天数阈值
  rewardPoints: integer('reward_points').notNull(), // 奖励积分
  extraReward: jsonb('extra_reward').default({}), // 额外奖励（如优惠券、勋章）
  status: integer('status').default(1).notNull(), // 1-启用 0-禁用
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type UserPoints = typeof userPoints.$inferSelect
export type NewUserPoints = typeof userPoints.$inferInsert
export type PointTransaction = typeof pointTransactions.$inferSelect
export type NewPointTransaction = typeof pointTransactions.$inferInsert
export type SignInRecord = typeof signInRecords.$inferSelect
export type NewSignInRecord = typeof signInRecords.$inferInsert
export type Level = typeof levels.$inferSelect
export type NewLevel = typeof levels.$inferInsert
export type SignInRule = typeof signInRules.$inferSelect
export type NewSignInRule = typeof signInRules.$inferInsert
