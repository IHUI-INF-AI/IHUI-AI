/**
 * A/B 测试持久化表(2026-07-25 立,对标 ABTestTracker)。
 *
 * 由 apps/ai-service(app/services/ab_test_tracker.py)以 raw SQL 读写,
 * 此处补 TS schema 定义以消除 check-db-schema-drift 的 dead migration 告警,
 * 并保持 packages/database 单一数据源的表名 ↔ migration 一致性。
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

export const abTests = pgTable(
  'ab_tests',
  {
    id: uuid('id').primaryKey().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 64 }).notNull(),
    trafficPercent: integer('traffic_percent').default(0).notNull(),
    targetMetric: varchar('target_metric', { length: 128 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    winningVariantId: uuid('winning_variant_id'),
    config: jsonb('config'),
    autoPromote: boolean('auto_promote').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('idx_ab_tests_status').on(t.status),
  }),
)


export type AbTest = typeof abTests.$inferSelect
export type NewAbTest = typeof abTests.$inferInsert

