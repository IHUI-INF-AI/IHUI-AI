import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 附件结构(jsonb 数组)。
 * - url: 文件访问 URL(由 /api/files/upload/form 返回)
 * - name: 原始文件名(用于显示)
 * - type: MIME 类型(image/jpeg, audio/mpeg, video/mp4, application/pdf 等)
 * - size: 文件字节数(用于校验配额)
 */
export interface AttachmentItem {
  url: string
  name: string
  type: string
  size: number
}

/**
 * 课程笔记表。
 * 用户针对某节课记录的笔记,可选择公开/私有。
 */
export const eduNotes = pgTable('edu_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  lessonId: uuid('lesson_id'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }),
  content: text('content').notNull(),
  isPublic: boolean('is_public').default(false).notNull(),
  attachments: jsonb('attachments').$type<AttachmentItem[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 线下学习记录表。
 * 用户自行登记的线下培训/会议/实践等记录,按学时统计。
 */
export const eduOfflineRecords = pgTable('edu_offline_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  hours: integer('hours').default(0).notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }),
  attachments: jsonb('attachments').$type<AttachmentItem[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 用户上传证书表。
 * 用户自行上传的证书,需管理员审核(status: pending/approved/rejected)。
 */
export const eduUploadedCerts = pgTable('edu_uploaded_certs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  certName: varchar('cert_name', { length: 100 }).notNull(),
  certUrl: varchar('cert_url', { length: 500 }),
  issuer: varchar('issuer', { length: 100 }),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  reason: text('reason'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 用户上传论文表。
 * 用户自行上传的论文/作品,需管理员审核(status: pending/approved/rejected)。
 */
export const eduUploadedPapers = pgTable('edu_uploaded_papers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  paperTitle: varchar('paper_title', { length: 200 }).notNull(),
  paperUrl: varchar('paper_url', { length: 500 }),
  courseId: varchar('course_id', { length: 100 }),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  reason: text('reason'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type EduNote = typeof eduNotes.$inferSelect
export type NewEduNote = typeof eduNotes.$inferInsert
export type EduOfflineRecord = typeof eduOfflineRecords.$inferSelect
export type NewEduOfflineRecord = typeof eduOfflineRecords.$inferInsert
export type EduUploadedCert = typeof eduUploadedCerts.$inferSelect
export type NewEduUploadedCert = typeof eduUploadedCerts.$inferInsert
export type EduUploadedPaper = typeof eduUploadedPapers.$inferSelect
export type NewEduUploadedPaper = typeof eduUploadedPapers.$inferInsert

/**
 * 班级课程表 (R81 补建)。
 * D 盘 coze_zhs_py/models 暂未找到对应表(迁移目标: edu_classes_schedules 班级课程排期)。
 * 字段说明:
 *  - classId: 班级 ID(可对应 lessons/team 等)
 *  - lessonId: 课程 ID(关联 lessons 表)
 *  - lessonName: 课程名称(冗余)
 *  - teacherName: 教师姓名(冗余)
 *  - scheduledAt: 开课时间
 *  - durationMinutes: 课程时长(分钟)
 *  - location: 教室/地点
 *  - status: scheduled / ongoing / completed / cancelled
 */
export const eduClassesSchedules = pgTable(
  'edu_classes_schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    classId: varchar('class_id', { length: 64 }).notNull(),
    lessonId: varchar('lesson_id', { length: 64 }),
    lessonName: varchar('lesson_name', { length: 200 }),
    teacherName: varchar('teacher_name', { length: 100 }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').default(60).notNull(),
    location: varchar('location', { length: 200 }),
    status: varchar('status', { length: 20 }).default('scheduled').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    classIdx: index('edu_classes_schedules_class_idx').on(t.classId),
    scheduledIdx: index('edu_classes_schedules_scheduled_idx').on(t.scheduledAt),
    statusIdx: index('edu_classes_schedules_status_idx').on(t.status),
  }),
)

/**
 * 班级成员表 (R81 补建)。
 * 字段说明:
 *  - classId: 班级 ID
 *  - userId: 学员 ID
 *  - role: student / assistant / teacher
 *  - joinedAt: 加入时间
 *  - status: active / inactive / graduated
 */
export const eduClassesMembers = pgTable(
  'edu_classes_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    classId: varchar('class_id', { length: 64 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).default('student').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    classIdx: index('edu_classes_members_class_idx').on(t.classId),
    userIdx: index('edu_classes_members_user_idx').on(t.userId),
    statusIdx: index('edu_classes_members_status_idx').on(t.status),
  }),
)

export type EduClassesSchedule = typeof eduClassesSchedules.$inferSelect
export type NewEduClassesSchedule = typeof eduClassesSchedules.$inferInsert
export type EduClassesMember = typeof eduClassesMembers.$inferSelect
export type NewEduClassesMember = typeof eduClassesMembers.$inferInsert
