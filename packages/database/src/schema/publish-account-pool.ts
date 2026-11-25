// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  bigint,
  bigserial,
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 发布账号池 + 会话守护(2026-11-25 新增)。
 *
 * 与 ai-service `app/services/publish/account_pool.py` / `session_keeper.py`
 * 字段严格对齐(ai-service 用 asyncpg 裸 SQL,本文件只做 schema 与迁移的单一快照):
 *   - publish_pools:           一个平台一个池(可多个),策略/最低在线数/体检间隔
 *   - publish_pool_members:    池成员(优先级/权重/日配额/最近使用时间)
 *   - publish_session_state:   每个账号一行会话状态(由 session_keeper 写)
 *   - publish_session_events:  体检事件流(谁在什么时候因为什么掉线)
 *
 * 状态机: unknown → healthy / degraded → reauth_required → healthy(扫码回池)
 * 边界:本层不存 cookie 明文,也不改写 publish_accounts.credentials_enc;
 * 体检失败只写状态与事件,凭据更新仍走 credential_history 唯一出口。
 */

export const publishPools = pgTable('publish_pools', {
  poolId: varchar('pool_id', { length: 40 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  platform: varchar('platform', { length: 32 }).notNull(),
  name: varchar('name', { length: 128 }).notNull().default('默认账号池'),
  /** least_recent=最久未用 / priority=优先级 / round_robin=轮询 */
  strategy: varchar('strategy', { length: 16 }).notNull().default('least_recent'),
  minHealthy: integer('min_healthy').notNull().default(1),
  maxDailyPosts: integer('max_daily_posts').notNull().default(0),
  probeIntervalMinutes: integer('probe_interval_minutes').notNull().default(45),
  autoReauth: boolean('auto_reauth').notNull().default(true),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const publishPoolMembers = pgTable(
  'publish_pool_members',
  {
    poolId: varchar('pool_id', { length: 40 })
      .notNull()
      .references(() => publishPools.poolId, { onDelete: 'cascade' }),
    accountId: bigint('account_id', { mode: 'bigint' }).notNull(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    priority: integer('priority').notNull().default(100),
    weight: integer('weight').notNull().default(1),
    dailyQuota: integer('daily_quota').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.poolId, t.accountId] })],
)

export const publishSessionState = pgTable('publish_session_state', {
  accountId: bigint('account_id', { mode: 'bigint' }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  platform: varchar('platform', { length: 32 }).notNull(),
  status: varchar('status', { length: 24 }).notNull().default('unknown'),
  lastProbeAt: timestamp('last_probe_at', { withTimezone: true }),
  lastOkAt: timestamp('last_ok_at', { withTimezone: true }),
  nextProbeAt: timestamp('next_probe_at', { withTimezone: true }),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  lastError: text('last_error'),
  lastErrorKind: varchar('last_error_kind', { length: 24 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  reauthTaskId: varchar('reauth_task_id', { length: 64 }),
  reauthStartedAt: timestamp('reauth_started_at', { withTimezone: true }),
  probeIntervalMinutes: integer('probe_interval_minutes').notNull().default(60),
  lastDurationMs: integer('last_duration_ms'),
  lastAlertAt: timestamp('last_alert_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const publishSessionEvents = pgTable('publish_session_events', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  accountId: bigint('account_id', { mode: 'bigint' }).notNull(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  platform: varchar('platform', { length: 32 }).notNull(),
  ok: boolean('ok').notNull(),
  kind: varchar('kind', { length: 24 }).notNull(),
  message: text('message'),
  detail: jsonb('detail'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type PublishPool = typeof publishPools.$inferSelect
export type NewPublishPool = typeof publishPools.$inferInsert
export type PublishPoolMember = typeof publishPoolMembers.$inferSelect
export type NewPublishPoolMember = typeof publishPoolMembers.$inferInsert
export type PublishSessionState = typeof publishSessionState.$inferSelect
export type NewPublishSessionState = typeof publishSessionState.$inferInsert
export type PublishSessionEvent = typeof publishSessionEvents.$inferSelect
export type NewPublishSessionEvent = typeof publishSessionEvents.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
