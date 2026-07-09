import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

/**
 * 统计快照表 - 周期性保存各业务模块的聚合统计指标。
 * - type: 快照类型，如 'overview' | 'learn' | 'exam' | 'content'。
 * - data: 快照数据(jsonb)，由业务层定义结构。
 * - createdBy: 创建者(可选)。
 */
export const statisticsSnapshots = pgTable(
  'statistics_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: varchar('type', { length: 50 }).notNull(), // overview/learn/exam/content
    data: jsonb('data').notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    typeIdx: index('statistics_snapshots_type_idx').on(t.type),
    createdIdx: index('statistics_snapshots_created_idx').on(t.createdAt),
  }),
);

export type StatisticsSnapshot = typeof statisticsSnapshots.$inferSelect;
export type NewStatisticsSnapshot = typeof statisticsSnapshots.$inferInsert;
