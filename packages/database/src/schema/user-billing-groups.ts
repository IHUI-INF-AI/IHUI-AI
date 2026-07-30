import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  boolean,
  numeric,
  index,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * 用户计费分组表(P0 中转站造血能力批次,2026-08-01 立)。
 *
 * 用户可分入计费分组,每组对不同模型有独立倍率(如 svip 组 gpt-4 = 0.8 = 8 折)。
 * 订阅包自动入组(买 Pro → vip 组,买 Enterprise → svip 组)。
 *
 * - defaultMultiplier: 组默认倍率(无模型级覆盖时用此倍率),1.00 = 原价,0.80 = 8 折
 * - rateLimitQpm: 每分钟请求数限制
 * - isDefault: 系统默认组(新用户自动入此组),全表仅 1 行为 true
 */
export const userBillingGroups = pgTable(
  'user_billing_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 64 }).notNull(),
    description: text('description'),
    defaultMultiplier: numeric('default_multiplier', { precision: 5, scale: 2 })
      .default('1.00')
      .notNull(),
    rateLimitQpm: integer('rate_limit_qpm').default(10).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameUniq: unique('user_billing_groups_name_unique').on(t.name),
    enabledIdx: index('user_billing_groups_enabled_idx').on(t.enabled),
    sortOrderIdx: index('user_billing_groups_sort_order_idx').on(t.sortOrder),
  }),
)

/**
 * 用户-分组关联表。
 * 一个用户同时只在一个组(userId unique)。
 * - assignedReason: 'subscription'(订阅激活)/'manual'(管理员手动)/'invite'(邀请)
 * - expiresAt: 订阅到期自动降级(到期后 getUserBillingGroup 回退到 default 组)
 */
export const userBillingGroupMembers = pgTable(
  'user_billing_group_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().unique(),
    groupId: uuid('group_id')
      .references(() => userBillingGroups.id, { onDelete: 'cascade' })
      .notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
    assignedReason: varchar('assigned_reason', { length: 128 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    groupIdIdx: index('user_billing_group_members_group_id_idx').on(t.groupId),
    expiresAtIdx: index('user_billing_group_members_expires_at_idx').on(t.expiresAt),
  }),
)

/**
 * 分组-模型倍率覆盖表(二维矩阵)。
 * 无覆盖则用组默认倍率(userBillingGroups.defaultMultiplier)。
 * - multiplier: 0.80 = 8 折,1.00 = 原价,1.20 = 加价 20%
 */
export const userBillingGroupModelMultipliers = pgTable(
  'user_billing_group_model_multipliers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .references(() => userBillingGroups.id, { onDelete: 'cascade' })
      .notNull(),
    modelId: varchar('model_id', { length: 128 }).notNull(),
    multiplier: numeric('multiplier', { precision: 5, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    groupModelUniq: unique('user_billing_group_model_multipliers_group_model_unique').on(
      t.groupId,
      t.modelId,
    ),
    groupIdIdx: index('user_billing_group_model_multipliers_group_id_idx').on(t.groupId),
  }),
)

export type UserBillingGroup = typeof userBillingGroups.$inferSelect
export type NewUserBillingGroup = typeof userBillingGroups.$inferInsert
export type UserBillingGroupMember = typeof userBillingGroupMembers.$inferSelect
export type NewUserBillingGroupMember = typeof userBillingGroupMembers.$inferInsert
export type UserBillingGroupModelMultiplier = typeof userBillingGroupModelMultipliers.$inferSelect
export type NewUserBillingGroupModelMultiplier =
  typeof userBillingGroupModelMultipliers.$inferInsert
