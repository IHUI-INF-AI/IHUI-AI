import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 课程作业表。
 * content: jsonb 存储作业题目/配置。
 * status: 'draft' | 'published'。
 */
export const learnHomework = pgTable(
  'learn_homework',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lessonId: uuid('lesson_id').notNull(),
    chapterId: uuid('chapter_id'),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    content: jsonb('content'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    sort: integer('sort').default(0).notNull(),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    lessonIdx: index('learn_homework_lesson_idx').on(t.lessonId),
    chapterIdx: index('learn_homework_chapter_idx').on(t.chapterId),
  }),
);

/**
 * 学习地图表。
 * content: jsonb 存储地图节点/路径配置。
 */
export const learnMaps = pgTable(
  'learn_maps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    cover: varchar('cover', { length: 500 }),
    content: jsonb('content'),
    sort: integer('sort').default(0).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pubIdx: index('learn_maps_published_idx').on(t.isPublished),
  }),
);

/**
 * 发票申请表。
 * type: 发票类型(增值税普通/专用等)。
 * status: 'pending' | 'approved' | 'rejected' | 'invoicing' | 'invoiced' | 'canceled'。
 */
export const learnInvoiceApplications = pgTable(
  'learn_invoice_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: varchar('order_id', { length: 100 }).notNull(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    taxNo: varchar('tax_no', { length: 50 }).notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    detail: text('detail'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('learn_invoice_applications_user_idx').on(t.userId),
    statusIdx: index('learn_invoice_applications_status_idx').on(t.status),
  }),
);

/**
 * 发票抬头表。
 * type: 抬头类型(个人/企业)。
 */
export const learnInvoiceTitles = pgTable(
  'learn_invoice_titles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    taxNo: varchar('tax_no', { length: 50 }).notNull(),
    bank: varchar('bank', { length: 100 }),
    bankAccount: varchar('bank_account', { length: 100 }),
    address: varchar('address', { length: 200 }),
    phone: varchar('phone', { length: 50 }),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('learn_invoice_titles_user_idx').on(t.userId),
  }),
);

export type LearnHomework = typeof learnHomework.$inferSelect;
export type NewLearnHomework = typeof learnHomework.$inferInsert;
export type LearnMap = typeof learnMaps.$inferSelect;
export type NewLearnMap = typeof learnMaps.$inferInsert;
export type LearnInvoiceApplication = typeof learnInvoiceApplications.$inferSelect;
export type NewLearnInvoiceApplication = typeof learnInvoiceApplications.$inferInsert;
export type LearnInvoiceTitle = typeof learnInvoiceTitles.$inferSelect;
export type NewLearnInvoiceTitle = typeof learnInvoiceTitles.$inferInsert;
