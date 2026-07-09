import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 浏览记录表 - 记录用户对各类资源(课程/资讯/文章/资源)的浏览行为。
 * 同一用户对同一目标重复浏览时累加时长并更新位置。
 */
export const behaviorWatchRecords = pgTable(
  'behavior_watch_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    topicId: varchar('topic_id', { length: 128 }).notNull(), // 目标 ID
    topicType: varchar('topic_type', { length: 50 }).notNull(), // lesson/news/article/resource
    topicTitle: varchar('topic_title', { length: 200 }),
    watchDuration: integer('watch_duration').default(0).notNull(), // 累计观看时长(秒)
    lastPosition: integer('last_position').default(0).notNull(), // 上次位置
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: unique('behavior_watch_records_user_topic_unique').on(t.userId, t.topicId, t.topicType),
    topicIdx: index('behavior_watch_records_topic_idx').on(t.topicId, t.topicType),
    userIdx: index('behavior_watch_records_user_idx').on(t.userId),
  }),
);

export type BehaviorWatchRecord = typeof behaviorWatchRecords.$inferSelect;
export type NewBehaviorWatchRecord = typeof behaviorWatchRecords.$inferInsert;
