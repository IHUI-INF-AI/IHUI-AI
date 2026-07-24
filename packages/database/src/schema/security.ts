import { pgTable, uuid, varchar, integer, timestamp, jsonb, index, text } from 'drizzle-orm/pg-core'

/**
 * API Key 调用配额表。
 * - hourlyUsed / dailyUsed：当前小时/当天已用调用次数。
 * - resetAt：下次重置时间（按小时滚动）。
 * - 每小时重置 hourlyUsed，每天结束重置 dailyUsed。
 */
export const apiKeyQuotas = pgTable(
  'api_key_quotas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    apiKeyId: varchar('api_key_id', { length: 128 }).notNull().unique(),
    hourlyUsed: integer('hourly_used').default(0).notNull(),
    dailyUsed: integer('daily_used').default(0).notNull(),
    hourlyLimit: integer('hourly_limit').default(1000).notNull(),
    dailyLimit: integer('daily_limit').default(10000).notNull(),
    resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    apiKeyIdx: index('api_key_quotas_key_idx').on(t.apiKeyId),
  }),
)

/**
 * Outbox 事件表（可靠消息模式）。
 * 事务内写入 → 事务后异步发送 → 标记 processed。
 * - status: pending | processed | failed。
 * - attempts：重试次数；超过阈值标记 failed。
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: varchar('type', { length: 64 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lastError: text('last_error'),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index('outbox_events_status_idx').on(t.status),
    createdIdx: index('outbox_events_created_idx').on(t.createdAt),
  }),
)

export type ApiKeyQuota = typeof apiKeyQuotas.$inferSelect
export type NewApiKeyQuota = typeof apiKeyQuotas.$inferInsert
export type OutboxEvent = typeof outboxEvents.$inferSelect
export type NewOutboxEvent = typeof outboxEvents.$inferInsert
