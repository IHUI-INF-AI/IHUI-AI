import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * A/B 测试实验表。
 * - status: draft / running / paused / completed / archived。
 * - traffic_percent: 实验占用总流量百分比（0~100）。
 * - target_metric: 评估指标（如 conversion_rate / click_through / retention_d1）。
 * - winning_variant_id: 实验结束时记录的获胜变体。
 */
export const abTests = pgTable(
  'ab_tests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull().unique(),
    description: text('description'),
    status: varchar('status', { length: 32 }).default('draft').notNull(),
    trafficPercent: integer('traffic_percent').default(100).notNull(),
    targetMetric: varchar('target_metric', { length: 100 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    winningVariantId: uuid('winning_variant_id'),
    config: jsonb('config').notNull().default({}),
    autoPromote: boolean('auto_promote').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ab_tests_status_idx').on(t.status),
  }),
)

/**
 * A/B 测试变体表（实验组 / 对照组）。
 * - is_control: 是否为对照组（每个实验有且仅有一个对照组）。
 * - traffic_weight: 流量分配权重（按比例分配，所有变体权重总和决定分配比例）。
 */
export const abTestVariants = pgTable(
  'ab_test_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    testId: uuid('test_id')
      .references(() => abTests.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    isControl: boolean('is_control').default(false).notNull(),
    trafficWeight: integer('traffic_weight').default(1).notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    testIdx: index('ab_test_variants_test_idx').on(t.testId),
    testNameUniq: unique('ab_test_variants_test_name_uniq').on(t.testId, t.name),
  }),
)

/**
 * A/B 测试结果聚合表。
 * 每小时/每日按 (variant_id + bucket) 维度聚合样本与转化数。
 * - bucket: 时间桶（如 '2026-07-11' 或 '2026-07-11T10'）。
 * - samples: 该桶内分配到该变体的总样本数。
 * - conversions: 该桶内达成 target_metric 的样本数。
 */
export const abTestResults = pgTable(
  'ab_test_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    testId: uuid('test_id')
      .references(() => abTests.id, { onDelete: 'cascade' })
      .notNull(),
    variantId: uuid('variant_id')
      .references(() => abTestVariants.id, { onDelete: 'cascade' })
      .notNull(),
    bucket: varchar('bucket', { length: 32 }).notNull(),
    samples: integer('samples').default(0).notNull(),
    conversions: integer('conversions').default(0).notNull(),
    revenue: integer('revenue').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    testIdx: index('ab_test_results_test_idx').on(t.testId),
    variantIdx: index('ab_test_results_variant_idx').on(t.variantId),
    variantBucketUniq: unique('ab_test_results_variant_bucket_uniq').on(t.variantId, t.bucket),
  }),
)

export type AbTest = typeof abTests.$inferSelect
export type NewAbTest = typeof abTests.$inferInsert
export type AbTestVariant = typeof abTestVariants.$inferSelect
export type NewAbTestVariant = typeof abTestVariants.$inferInsert
export type AbTestResult = typeof abTestResults.$inferSelect
export type NewAbTestResult = typeof abTestResults.$inferInsert
