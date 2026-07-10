import { pgTable, uuid, varchar, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { examPapers } from './exam.js';

/**
 * 试卷章节表(三级结构: 试卷 -> 章节 -> 小节)。
 * 章节归属于某张试卷,按 sort 排序。
 */
export const examChapters = pgTable(
  'exam_chapters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paperId: uuid('paper_id')
      .notNull()
      .references(() => examPapers.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    paperIdx: index('exam_chapters_paper_idx').on(t.paperId),
  }),
);

/**
 * 章节小节表。
 * 小节归属于某个章节,questionIds 为题目ID数组(jsonb)。
 */
export const examChapterSections = pgTable(
  'exam_chapter_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    chapterId: uuid('chapter_id')
      .notNull()
      .references(() => examChapters.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    questionIds: jsonb('question_ids'), // 题目ID数组 [uuid, ...]
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    chapterIdx: index('exam_chapter_sections_chapter_idx').on(t.chapterId),
  }),
);

/**
 * 考试报名表。
 * status: pending/confirmed/cancelled。
 */
export const examSignups = pgTable(
  'exam_signups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paperId: uuid('paper_id')
      .notNull()
      .references(() => examPapers.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    paperIdx: index('exam_signups_paper_idx').on(t.paperId),
    userIdx: index('exam_signups_user_idx').on(t.userId),
  }),
);

/**
 * 错题本表 (历史 exam_wrong_question)。
 * wrongCount: 错误次数。lastWrongTime: 最后错误时间。
 * isMastered: 是否已掌握。
 */
export const examWrongQuestion = pgTable(
  'exam_wrong_question',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    questionId: uuid('question_id').notNull(),
    paperId: uuid('paper_id').notNull(),
    paperTitle: varchar('paper_title', { length: 200 }),
    userAnswer: text('user_answer'),
    rightAnswer: text('right_answer'),
    wrongCount: integer('wrong_count').default(1).notNull(),
    lastWrongTime: timestamp('last_wrong_time', { withTimezone: true }),
    isMastered: boolean('is_mastered').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('exam_wrong_question_user_idx').on(t.userId),
    questionIdx: index('exam_wrong_question_question_idx').on(t.questionId),
  }),
);

export type ExamChapter = typeof examChapters.$inferSelect;
export type NewExamChapter = typeof examChapters.$inferInsert;
export type ExamChapterSection = typeof examChapterSections.$inferSelect;
export type NewExamChapterSection = typeof examChapterSections.$inferInsert;
export type ExamSignup = typeof examSignups.$inferSelect;
export type NewExamSignup = typeof examSignups.$inferInsert;
export type ExamWrongQuestion = typeof examWrongQuestion.$inferSelect;
export type NewExamWrongQuestion = typeof examWrongQuestion.$inferInsert;
