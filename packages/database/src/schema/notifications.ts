// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 通知表。
 * type: 'system' | 'order' | 'project' | 'comment' | 'mention'（用 varchar，避免 pg enum 兼容性问题）。
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: varchar('type', { length: 32 }).default('system').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content'),
    data: jsonb('data'),
    isRead: boolean('is_read').default(false).notNull(),
    // D195 隐藏=归档而非删除:null = 在动态流里,有值 = 已归档(值为归档时刻)。
    // 用可空时间戳而不是布尔,是因为"什么时候收走的"要在已归档分区回显,而布尔表达不了这一维。
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    /**
     * F-512:投递幂等键(队列 job 身份,如 `job:123`)。队列是至少一次语义,
     * 同一条 job 重投时靠 (user_id, idempotency_key) 唯一索引挡住重复落库。
     * NULL = 该通知不经队列投递(同步直写路径),唯一索引对 NULL 不去重(Postgres 语义)。
     */
    idempotencyKey: varchar('idempotency_key', { length: 128 }),
    /**
     * F-512:邮件出口的"投递占位/完成"两戳。
     * 先 CAS 抢占 claimed_at 再发信(跨实例只有一个能发),发成功后写 sent_at;
     * sent_at 非空即"已送达",重投只补站内信不补邮件。
     */
    emailClaimedAt: timestamp('email_claimed_at', { withTimezone: true }),
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // P1 索引补全(2026-08-06):按 userId 查询通知列表 + createdAt 排序是高频路径,
    // 原表无索引导致大表全表扫描,补 (user_id, created_at) 复合索引。
    userCreatedIdx: index('notifications_user_created_idx').on(t.userId, t.createdAt),
    // D195:两个分区各自按时间翻页,归档判据是 where 的第一维,不建索引就是每次全表扫。
    userArchivedIdx: index('notifications_user_archived_idx').on(t.userId, t.archivedAt),
    // F-512:队列重投的幂等锚点 —— 同一用户同一 job 只会有一行(ON CONFLICT DO NOTHING 的落点)。
    userIdemUq: uniqueIndex('notifications_user_idem_uq').on(t.userId, t.idempotencyKey),
  }),
)

/**
 * 站内信 / 会话消息表。
 */
export const messages = pgTable(
  'messages',
  {
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
  },
  (t) => ({
    // P1 索引补全(2026-08-06):会话列表/消息历史按 sender_id / receiver_id 查询 + createdAt 排序,
    // 原表无索引导致大表全表扫描,补 (receiver_id, created_at) 与 (sender_id, created_at) 索引。
    receiverCreatedIdx: index('messages_receiver_created_idx').on(t.receiverId, t.createdAt),
    senderCreatedIdx: index('messages_sender_created_idx').on(t.senderId, t.createdAt),
  }),
)

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
