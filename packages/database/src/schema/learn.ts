import { pgTable, uuid, varchar, text, integer, boolean, timestamp, numeric, index, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 课程分类表
 */
export const learnCategories = pgTable(
  'learn_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    pid: uuid('pid'), // 父分类(树形结构)
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(), // 1=启用 0=禁用
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pidIdx: index('learn_categories_pid_idx').on(t.pid),
  }),
);

/**
 * 课程表
 */
export const lessons = pgTable(
  'lessons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    coverImage: varchar('cover_image', { length: 512 }),
    intro: text('intro'),
    categoryId: uuid('category_id').references(() => learnCategories.id, { onDelete: 'set null' }),
    lecturerId: uuid('lecturer_id').references(() => users.id, { onDelete: 'set null' }),
    lecturerName: varchar('lecturer_name', { length: 100 }),
    price: numeric('price', { precision: 10, scale: 2 }).default('0').notNull(),
    originalPrice: numeric('original_price', { precision: 10, scale: 2 }),
    isFree: boolean('is_free').default(false).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    sort: integer('sort').default(0).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    signupCount: integer('signup_count').default(0).notNull(),
    lessonCount: integer('lesson_count').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('lessons_category_idx').on(t.categoryId),
    pubIdx: index('lessons_published_idx').on(t.isPublished),
  }),
);

/**
 * 章节表
 */
export const lessonChapters = pgTable(
  'lesson_chapters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    lessonIdx: index('lesson_chapters_lesson_idx').on(t.lessonId),
  }),
);

/**
 * 小节表
 */
export const lessonChapterSections = pgTable(
  'lesson_chapter_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    chapterId: uuid('chapter_id').notNull().references(() => lessonChapters.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content'),
    videoUrl: varchar('video_url', { length: 512 }),
    duration: integer('duration').default(0).notNull(), // 秒
    sortOrder: integer('sort_order').default(0).notNull(),
    isFree: boolean('is_free').default(false).notNull(), // 免费试看
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    chapIdx: index('lesson_chapter_sections_chapter_idx').on(t.chapterId),
  }),
);

/**
 * 报名记录表
 */
export const lessonSignUps = pgTable(
  'lesson_sign_ups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: integer('status').default(1).notNull(), // 1=已报名 2=已完成 3=已退款
    progress: integer('progress').default(0).notNull(), // 0-100
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: unique('lesson_sign_ups_lesson_user_unique').on(t.lessonId, t.userId),
    userIdx: index('lesson_sign_ups_user_idx').on(t.userId),
  }),
);

export type LearnCategory = typeof learnCategories.$inferSelect;
export type NewLearnCategory = typeof learnCategories.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
export type LessonChapter = typeof lessonChapters.$inferSelect;
export type NewLessonChapter = typeof lessonChapters.$inferInsert;
export type LessonChapterSection = typeof lessonChapterSections.$inferSelect;
export type NewLessonChapterSection = typeof lessonChapterSections.$inferInsert;
export type LessonSignUp = typeof lessonSignUps.$inferSelect;
export type NewLessonSignUp = typeof lessonSignUps.$inferInsert;
