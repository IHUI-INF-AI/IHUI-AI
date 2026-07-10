import { pgTable, uuid, varchar, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

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
});

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
});

export type EduNote = typeof eduNotes.$inferSelect;
export type NewEduNote = typeof eduNotes.$inferInsert;
export type EduOfflineRecord = typeof eduOfflineRecords.$inferSelect;
export type NewEduOfflineRecord = typeof eduOfflineRecords.$inferInsert;
export type EduUploadedCert = typeof eduUploadedCerts.$inferSelect;
export type NewEduUploadedCert = typeof eduUploadedCerts.$inferInsert;
export type EduUploadedPaper = typeof eduUploadedPapers.$inferSelect;
export type NewEduUploadedPaper = typeof eduUploadedPapers.$inferInsert;
