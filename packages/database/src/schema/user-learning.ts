import {
  pgTable,
  uuid,
  integer,
  real,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 用户课程报名表 (uuid 体系)。
 * userId: 关联 users.id (uuid)。
 * courseId: 课程 ID (uuid,暂无外键约束,未来对接课程表时补)。
 * status: 1=有效 0=已取消。
 */
export const userCourseEnrollments = pgTable(
  'user_course_enrollments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_course_enrollments_user_idx').on(t.userId),
  }),
)

/**
 * 用户学习记录表 (uuid 体系)。
 * userId: 关联 users.id (uuid)。
 * lessonId: 课时 ID (uuid,暂无外键约束)。
 * studyDuration: 学习时长(秒)。
 * progress: 学习进度 0-100。
 * lastPosition: 上次播放位置(秒)。
 */
export const userLearnRecords = pgTable(
  'user_learn_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id').notNull(),
    studyDuration: integer('study_duration').default(0).notNull(),
    progress: real('progress').default(0).notNull(),
    lastPosition: integer('last_position').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_learn_records_user_idx').on(t.userId),
  }),
)

export type UserCourseEnrollment = typeof userCourseEnrollments.$inferSelect
export type NewUserCourseEnrollment = typeof userCourseEnrollments.$inferInsert
export type UserLearnRecord = typeof userLearnRecords.$inferSelect
export type NewUserLearnRecord = typeof userLearnRecords.$inferInsert
