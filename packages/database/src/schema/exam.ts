import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 试卷分类表。
 */
export const examCategories = pgTable(
  'exam_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    pid: uuid('pid'), // 父分类(树形结构)
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(), // 1=启用 0=禁用
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pidIdx: index('exam_categories_pid_idx').on(t.pid),
  }),
)

/**
 * 试卷表。
 * total_score/pass_score: numeric(6,2)。
 * duration: 考试时长(分钟)。
 * is_random: 是否随机抽题。
 * question_count: 题目数量(冗余字段,创建/更新题目时同步)。
 * status: 1=正常。
 */
export const examPapers = pgTable('exam_papers', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  categoryId: uuid('category_id').references(() => examCategories.id, { onDelete: 'set null' }),
  paperType: varchar('paper_type', { length: 50 }).default('normal').notNull(),
  totalScore: numeric('total_score', { precision: 6, scale: 2 }).default('100').notNull(),
  passScore: numeric('pass_score', { precision: 6, scale: 2 }).default('60').notNull(),
  duration: integer('duration').default(60).notNull(), // 分钟
  isPublished: boolean('is_published').default(false).notNull(),
  isRandom: boolean('is_random').default(false).notNull(), // 随机抽题
  questionDisordered: boolean('question_disordered').default(false).notNull(), // 题目乱序
  optionDisordered: boolean('option_disordered').default(false).notNull(), // 选项乱序
  difficulty: integer('difficulty').default(3).notNull(), // 难度 1-5
  questionCount: integer('question_count').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 题目表。
 * type: 'single_choice' | 'multi_choice' | 'judgment' | 'fill_blank' | 'subjective'。
 * options: 选项数组 [{ key, text }]。
 * answer: 正确答案(单选: "A", 多选: ["A","B"], 判断: true, 填空: ["答案"], 主观: 参考答案)。
 * analysis: 解析。
 * score: 题目分值 numeric(6,2)。
 */
export const examQuestions = pgTable('exam_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  paperId: uuid('paper_id')
    .notNull()
    .references(() => examPapers.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(), // single_choice/multi_choice/judgment/fill_blank/subjective
  title: text('title').notNull(),
  options: jsonb('options'), // 选项数组 [{key, text}]
  answer: jsonb('answer'), // 正确答案(单选: "A", 多选: ["A","B"], 判断: true, 填空: ["答案"], 主观: 参考答案)
  analysis: text('analysis'), // 解析
  score: numeric('score', { precision: 6, scale: 2 }).default('5').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 答题记录表。
 * answers: [{ questionId, answer, isCorrect, score }]。
 * score: 得分 numeric(6,2)。
 * status: 'pending' | 'submitted' | 'graded'。
 * duration: 实际用时(秒)。
 */
export const examRecords = pgTable('exam_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  paperId: uuid('paper_id')
    .notNull()
    .references(() => examPapers.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  answers: jsonb('answers'), // [{questionId, answer, isCorrect}]
  score: numeric('score', { precision: 6, scale: 2 }).default('0').notNull(),
  isPassed: boolean('is_passed').default(false).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending/submitted/graded
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  duration: integer('duration').default(0).notNull(), // 实际用时(秒)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ExamCategory = typeof examCategories.$inferSelect
export type NewExamCategory = typeof examCategories.$inferInsert
export type ExamPaper = typeof examPapers.$inferSelect
export type NewExamPaper = typeof examPapers.$inferInsert
export type ExamQuestion = typeof examQuestions.$inferSelect
export type NewExamQuestion = typeof examQuestions.$inferInsert
export type ExamRecord = typeof examRecords.$inferSelect
export type NewExamRecord = typeof examRecords.$inferInsert
