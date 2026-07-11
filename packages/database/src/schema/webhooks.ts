import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * Webhook 配置表。
 * events: 订阅事件类型列表（jsonb 数组，如 ['order.paid', 'user.created']）。
 * status: 'active'(启用) / 'disabled'(已禁用)。
 * secret: 用于校验请求签名（HMAC），存储需哈希。
 */
export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    url: varchar('url', { length: 512 }).notNull(),
    events: jsonb('events').notNull().default([]),
    secret: varchar('secret', { length: 255 }),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('webhooks_user_idx').on(t.userId),
    statusIdx: index('webhooks_status_idx').on(t.status),
  }),
)

/**
 * Webhook 事件投递日志表。
 * status: 'success'(成功) / 'failed'(失败) / 'pending'(待重试)。
 * response_code: HTTP 响应码。attempts: 已重试次数。
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    webhookId: uuid('webhook_id')
      .references(() => webhooks.id, { onDelete: 'cascade' })
      .notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    responseCode: integer('response_code'),
    responseBody: text('response_body'),
    attempts: integer('attempts').default(0).notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    webhookIdx: index('webhook_events_webhook_idx').on(t.webhookId),
    statusIdx: index('webhook_events_status_idx').on(t.status),
  }),
)

export type Webhook = typeof webhooks.$inferSelect
export type NewWebhook = typeof webhooks.$inferInsert
export type WebhookEvent = typeof webhookEvents.$inferSelect
export type NewWebhookEvent = typeof webhookEvents.$inferInsert
