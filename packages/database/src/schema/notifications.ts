import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 通知表。
 * type: 'system' | 'order' | 'project' | 'comment' | 'mention'（用 varchar，避免 pg enum 兼容性问题）。
 */
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  type: varchar('type', { length: 32 }).default('system').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  data: jsonb('data'),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 站内信 / 会话消息表。
 */
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  senderId: uuid('sender_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  receiverId: uuid('receiver_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

/**
 * 用户通知偏好表。
 * quietHoursStart/quietHoursEnd 使用 "HH:mm" 字符串格式。
 * 该表此前通过 raw SQL 访问(见 apps/api/src/routes/notification-extended.ts),
 * 这里补 TS 定义以便 Drizzle 类型推导与 db:generate 正确生成。
 */
export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  emailEnabled: boolean('email_enabled').default(true).notNull(),
  smsEnabled: boolean('sms_enabled').default(false).notNull(),
  pushEnabled: boolean('push_enabled').default(true).notNull(),
  inAppEnabled: boolean('in_app_enabled').default(true).notNull(),
  types: jsonb('types')
    .$type<string[]>()
    .default(['system', 'order', 'project', 'comment', 'mention'])
    .notNull(),
  // 扩展 5 字段(0088):静默时段 + 频率限制
  quietHoursEnabled: boolean('quiet_hours_enabled').default(false).notNull(),
  quietHoursStart: varchar('quiet_hours_start', { length: 8 }),
  quietHoursEnd: varchar('quiet_hours_end', { length: 8 }),
  maxPerHour: integer('max_per_hour').default(20).notNull(),
  maxPerDay: integer('max_per_day').default(100).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type NotificationPreference = typeof notificationPreferences.$inferSelect
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert
