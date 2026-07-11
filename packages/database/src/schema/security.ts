import { pgTable, uuid, varchar, integer, timestamp, jsonb, index, text } from 'drizzle-orm/pg-core'

/**
 * 审计 hash 链条目表（防篡改）。
 * 每条记录包含 previousHash + data → hash，形成 append-only 链。
 * 任何中间记录被篡改都会导致后续 hash 校验失败。
 */
export const auditChainEntries = pgTable(
  'audit_chain_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    previousHash: varchar('previous_hash', { length: 64 }).notNull(),
    hash: varchar('hash', { length: 64 }).notNull().unique(),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    hashIdx: index('audit_chain_entries_hash_idx').on(t.hash),
    createdIdx: index('audit_chain_entries_created_idx').on(t.createdAt),
  }),
)

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

export type AuditChainEntry = typeof auditChainEntries.$inferSelect
export type NewAuditChainEntry = typeof auditChainEntries.$inferInsert
export type ApiKeyQuota = typeof apiKeyQuotas.$inferSelect
export type NewApiKeyQuota = typeof apiKeyQuotas.$inferInsert
export type OutboxEvent = typeof outboxEvents.$inferSelect
export type NewOutboxEvent = typeof outboxEvents.$inferInsert
