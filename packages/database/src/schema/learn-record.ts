import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { lessons } from './learn.js';
import { lessonChapters, lessonChapterSections } from './learn.js';

/**
 * 学习记录表 (对应 Java t_record)。
 * 每个用户对每个课程小节的学习记录(幂等:同用户同 lesson 同 section 仅一条)。
 * watchDuration: 累计观看时长(秒)。totalDuration: 小节总时长(秒)。
 * progress: 0-100 完成度。status: 0=未开始 1=进行中 2=已完成。
 * lastPosition: 上次观看位置(秒),用于断点续播。
 */
export const lessonRecords = pgTable(
  'lesson_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
    chapterId: uuid('chapter_id').references(() => lessonChapters.id, { onDelete: 'set null' }),
    sectionId: uuid('section_id').references(() => lessonChapterSections.id, { onDelete: 'set null' }),
    watchDuration: integer('watch_duration').default(0).notNull(),
    totalDuration: integer('total_duration').default(0).notNull(),
    progress: integer('progress').default(0).notNull(),
    status: integer('status').default(0).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    lastPosition: integer('last_position').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userLessonIdx: index('lesson_records_user_lesson_idx').on(t.userId, t.lessonId),
    sectionIdx: index('lesson_records_section_idx').on(t.sectionId),
    uniqUserSection: unique('lesson_records_user_lesson_section_unique').on(
      t.userId,
      t.lessonId,
      t.sectionId,
    ),
  }),
);

/**
 * 学习记录日志表 (对应 Java t_record_log)。
 * 每次心跳/seek/pause/complete 上报追加一条日志。
 * action: heartbeat/seek/pause/complete。
 * position: 当前位置(秒)。duration: 本次心跳时长(秒)。
 */
export const lessonRecordLogs = pgTable(
  'lesson_record_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recordId: uuid('record_id').notNull().references(() => lessonRecords.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 20 }).default('heartbeat').notNull(),
    position: integer('position').default(0).notNull(),
    duration: integer('duration').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    recordIdx: index('lesson_record_logs_record_idx').on(t.recordId),
    userIdx: index('lesson_record_logs_user_idx').on(t.userId),
  }),
);

export type LessonRecord = typeof lessonRecords.$inferSelect;
export type NewLessonRecord = typeof lessonRecords.$inferInsert;
export type LessonRecordLog = typeof lessonRecordLogs.$inferSelect;
export type NewLessonRecordLog = typeof lessonRecordLogs.$inferInsert;
