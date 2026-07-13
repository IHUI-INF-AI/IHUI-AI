import { pgTable, uuid, varchar, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 用户偏好设置表 (user_preferences) - 按用户隔离的键值对配置,按 group 分组。
 * 与 edu_settings 区分:本表存储登录用户个人偏好(notifications/privacy/preferences/devices 等)。
 * - group: 配置分组(notifications/privacy/preferences/devices)
 * - key: 配置键(同 user + group 内唯一)
 * - value: 字符串值(数字/布尔/json 也以字符串存储,业务层自行解析)
 */
export const userPreferences = pgTable(
  'user_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    group: varchar('group', { length: 50 }).notNull(),
    key: varchar('key', { length: 100 }).notNull(),
    value: text('value'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userGroupKeyIdx: unique('user_preferences_user_group_key_unique').on(t.userId, t.group, t.key),
  }),
)

export type UserPreference = typeof userPreferences.$inferSelect
export type NewUserPreference = typeof userPreferences.$inferInsert
