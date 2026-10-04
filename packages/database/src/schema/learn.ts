// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  index,
  unique,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'
// ↓ 报名 → 学习计划的外键列需要 studyPlans(见 lessonSignUps.studyPlanId)。
// study.ts 已经 import 本文件的 lessons ⇒ 这里构成**双向 import**。可行,因为:
//   ① ESM 只 import 绑定,study.ts 在 import 期不读本文件的任何导出;
//   ② drizzle 的 references() 把 ref 包进 ForeignKeyBuilder 惰性求值
//      (drizzle-orm/pg-core/columns/common.js:33-40 —— buildForeignKeys 只登记,
//      真正 ref() 在 getTableConfig()/建表时),故 TDZ 不会在模块求值期被触发。
// 显式标 AnyPgColumn 与 resource.ts / comments.ts 的既有写法一致,也是 TS 打破
// 跨文件循环推断的必要标注。
import { studyPlans } from './study.js'

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
)

/** 课程难度取值域(与公开筛选轴 / 前端档位同名,单一来源在本文件)。 */
export const LESSON_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export type LessonDifficulty = (typeof LESSON_DIFFICULTIES)[number]

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
    /**
     * 难度轴(2026-09-28 加列)。**可空且无默认值** —— 历史行没有可信来源可回填,
     * 按标题/分类猜难度等于制造假数据,所以只允许"新数据显式写、老数据保持 NULL"。
     * 取值域由 LESSON_DIFFICULTIES 定义;SQL 层不加 CHECK(既有行不受影响不代表新写入
     * 不该被服务端校验挡住 —— 唯一的写入口 routes/learn.ts 用同一份常量做 Zod 校验,
     * 判据与列同源,不在两处各写一份)。
     */
    difficulty: varchar('difficulty', { length: 20 }).$type<LessonDifficulty | null>(),
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
)

/**
 * 章节表
 */
export const lessonChapters = pgTable(
  'lesson_chapters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    lessonIdx: index('lesson_chapters_lesson_idx').on(t.lessonId),
  }),
)

/**
 * 小节表
 */
export const lessonChapterSections = pgTable(
  'lesson_chapter_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    chapterId: uuid('chapter_id')
      .notNull()
      .references(() => lessonChapters.id, { onDelete: 'cascade' }),
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
)

/**
 * 报名记录表
 * - studyPlanId: 报名所属的学习计划(2026-10-04 加列)。**可空且无默认值** —— 历史行
 *   没有可信来源可回填(此前报名与计划之间没有任何关联列),按标题/时间猜等于制造假数据,
 *   所以只允许"新数据显式写、老数据保持 NULL"。读侧 /api/study/plans 用 **leftJoin**
 *   取计划名,join 不上时回落课程名 —— "只有报名、没有计划"是正常态,不是缺陷。
 *   FK 用 set null(同 study.ts 的 study_plans.lesson_id):计划被删不该连带删掉报名。
 *   UNIQUE(lesson_id, user_id) 已保证同一课程同一用户只有一行报名 ⇒ 无需再加唯一约束。
 */
export const lessonSignUps = pgTable(
  'lesson_sign_ups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    studyPlanId: uuid('study_plan_id').references((): AnyPgColumn => studyPlans.id, {
      onDelete: 'set null',
    }),
    status: integer('status').default(1).notNull(), // 1=已报名 2=已完成 3=已退款
    progress: integer('progress').default(0).notNull(), // 0-100
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: unique('lesson_sign_ups_lesson_user_unique').on(t.lessonId, t.userId),
    userIdx: index('lesson_sign_ups_user_idx').on(t.userId),
    studyPlanIdx: index('lesson_sign_ups_study_plan_idx').on(t.studyPlanId),
  }),
)

export type LearnCategory = typeof learnCategories.$inferSelect
export type NewLearnCategory = typeof learnCategories.$inferInsert
export type Lesson = typeof lessons.$inferSelect
export type NewLesson = typeof lessons.$inferInsert
export type LessonChapter = typeof lessonChapters.$inferSelect
export type NewLessonChapter = typeof lessonChapters.$inferInsert
export type LessonChapterSection = typeof lessonChapterSections.$inferSelect
export type NewLessonChapterSection = typeof lessonChapterSections.$inferInsert
export type LessonSignUp = typeof lessonSignUps.$inferSelect
export type NewLessonSignUp = typeof lessonSignUps.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
