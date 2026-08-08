import { pgTable, uuid, varchar, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

/**
 * Relay Webhook 订阅表(2026-08-01 立,扩展 Webhook 系统)。
 *
 * 与 webhooks.ts(通用 webhook)的区别:
 * - 本表专注 relay 调用事件:relay.call.completed / relay.call.failed / relay.balance.low
 * - 含余额阈值(balance_threshold_cents),余额低于阈值触发 relay.balance.low
 * - secret 仅在创建时返回一次,后续查询脱敏(安全)
 * - 配套 webhook_delivery_logs 记录每次投递 + 指数退避重试(最多 3 次)
 *
 * events: jsonb 数组,如 ['relay.call.completed','relay.call.failed','relay.balance.low']
 * status: pending(首次)/ success / failed / retrying(待重试)
 */
export const webhookSubscriptions = pgTable(
  'webhook_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 订阅所属用户(关联 users.id,松耦合不加 FK 约束) */
    userId: uuid('user_id').notNull(),
    /** 回调 URL(接收方 POST 端点) */
    url: varchar('url', { length: 512 }).notNull(),
    /** 订阅事件列表(jsonb 数组,如 ['relay.call.completed','relay.call.failed','relay.balance.low']) */
    events: jsonb('events').$type<string[]>().notNull().default([]),
    /** HMAC-SHA256 签名密钥(用于校验请求体完整性,仅在创建时返回一次) */
    secret: varchar('secret', { length: 128 }).notNull(),
    /** 是否启用 */
    enabled: boolean('enabled').default(true).notNull(),
    /** 余额阈值(分,余额低于此值触发 relay.balance.low,默认 1000=10 元) */
    balanceThresholdCents: integer('balance_threshold_cents').default(1000),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('webhook_subscriptions_user_idx').on(t.userId),
    enabledIdx: index('webhook_subscriptions_enabled_idx').on(t.enabled),
  }),
)

/**
 * Relay Webhook 投递日志表。
 *
 * status: 'pending'(首次待发) / 'success'(成功) / 'failed'(最终失败,已耗尽重试) / 'retrying'(待重试)
 * attempt: 第几次尝试(1=首次,2=第一次重试,3=第二次重试,最多 3 次)
 * nextRetryAt: 下次重试时间(指数退避:now + 2^attempt 秒)
 */
export const webhookDeliveryLogs = pgTable(
  'webhook_delivery_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 关联 webhook_subscriptions.id */
    subscriptionId: uuid('subscription_id')
      .references(() => webhookSubscriptions.id, { onDelete: 'cascade' })
      .notNull(),
    /** 事件类型(如 relay.call.completed) */
    event: varchar('event', { length: 64 }).notNull(),
    /** 投递负载(jsonb,含事件数据) */
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    /** 接收方返回的 HTTP 状态码(2xx 视为成功) */
    responseStatus: integer('response_status'),
    /** 接收方返回的响应体(截断存储,用于调试) */
    responseBody: text('response_body'),
    /** 第几次尝试(1=首次,最多 3) */
    attempt: integer('attempt').default(1).notNull(),
    /** 投递状态:pending/success/failed/retrying */
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    /** 下次重试时间(指数退避:now + 2^attempt 秒) */
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    subscriptionIdx: index('webhook_delivery_logs_subscription_idx').on(t.subscriptionId),
    statusIdx: index('webhook_delivery_logs_status_idx').on(t.status),
    nextRetryIdx: index('webhook_delivery_logs_next_retry_idx').on(t.nextRetryAt),
  }),
)

export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert
export type WebhookDeliveryLog = typeof webhookDeliveryLogs.$inferSelect
export type NewWebhookDeliveryLog = typeof webhookDeliveryLogs.$inferInsert

/** Relay Webhook 事件类型枚举(用于类型安全的事件触发) */
export type RelayWebhookEvent =
  | 'relay.call.completed'
  | 'relay.call.failed'
  | 'relay.balance.low'
  | 'security.login_anomaly'
