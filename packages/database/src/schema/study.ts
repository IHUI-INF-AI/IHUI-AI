// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { examPapers } from './exam.js'
import { lessons } from './learn.js'

/**
 * 学生学习计划。
 * - target: 每日学习目标(分钟);进度不落库 —— 由 lesson_records 当日 watch_duration
 *   实时聚合得出(目标达成度 = 当日已学分钟 / target),避免"进度列与观看记录两处真相"。
 * - lessonId: 计划关联的课程(2026-10-04 加列)。**可空且无默认值** —— 历史行没有可信
 *   来源可回填(lesson_sign_ups 至今没有指向 study_plans 的列,报名与计划之间没有
 *   可推导的关系),按标题/时间猜等于制造假数据,所以只允许"新数据显式写、老数据保持 NULL"。
 *   FK 用 set null(同 lessons.categoryId):课程下架不该连带删掉用户的计划。
 */
export const studyPlans = pgTable(
  'study_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 100 }).notNull(),
    target: integer('target').default(30).notNull(),
    lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('study_plans_user_idx').on(t.userId), index('study_plans_lesson_idx').on(t.lessonId)],
)

/**
 * 学习动态(学习主页"发布"入口产出的内容)。
 * - visibility: private / public(公开动态后续可进广场,先落库收口写入链)。
 */
export const studyPosts = pgTable(
  'study_posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull(),
    category: varchar('category', { length: 50 }),
    visibility: varchar('visibility', { length: 20 }).default('private').notNull(),
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('study_posts_user_idx').on(t.userId)],
)

/**
 * AI 助教(讲解/提示/出题)问答日志。
 * - answer: ai-service 返回的 JSON 原样存档,供"最近问答"回放与后续教学分析。
 */
export const aiTutorLogs = pgTable(
  'ai_tutor_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    mode: varchar('mode', { length: 20 }).notNull(),
    subject: varchar('subject', { length: 20 }),
    question: text('question').notNull(),
    context: jsonb('context'),
    answer: jsonb('answer'),
    model: varchar('model', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('ai_tutor_logs_user_idx').on(t.userId)],
)

/**
 * 考试安排(取代 edu-extended.ts 里的内存 Map,重启不再丢)。
 * - 时间用 timestamptz;响应层转 ISO 字符串,保持前端契约不变。
 */
export const eduExamArrangements = pgTable(
  'edu_exam_arrangements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paperId: uuid('paper_id')
      .references(() => examPapers.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    location: varchar('location', { length: 200 }),
    invigilator: varchar('invigilator', { length: 100 }),
    duration: integer('duration').default(120).notNull(),
    status: varchar('status', { length: 20 }).default('scheduled').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('edu_exam_arrangements_paper_idx').on(t.paperId)],
)

/**
 * 组卷模板(取代 edu-extended.ts 里的内存 Map)。
 * - config: 模板配置原样存 jsonb(题型计数/难度分布等,结构由调用方定义)。
 */
export const eduAssembleTemplates = pgTable('edu_assemble_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  config: jsonb('config'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
