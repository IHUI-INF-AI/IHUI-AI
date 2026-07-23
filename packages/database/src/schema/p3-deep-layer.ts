/**
 * P3 深度层 schema — AI 教育引擎 + LangGraph 升级(2026-07-23 新增)。
 *
 * 本文件覆盖 P3 深度层的 5 张新表:
 * 1. ai_grading_record       AI 批改记录(主观题 AI 评分 + 教师审核)
 * 2. ai_generated_question    AI 出题记录(AI 生成题目 + 人工审核)
 * 3. knowledge_points         知识点(学科/章节树形结构,供随机抽题与 SRS 关联)
 * 4. langgraph_checkpoints    LangGraph 节点级 checkpoint(线程状态快照)
 * 5. langgraph_writes         LangGraph checkpoint 写入记录(channel 增量)
 *
 * 设计说明:
 * - 字段命名 camelCase(JS 侧) -> snake_case(DB 列名),由 Drizzle 自动转换
 * - 时间戳统一 `timestamp({ withTimezone: true }).defaultNow().notNull()`
 * - 状态字段用 varchar(N) + default,便于扩展枚举值
 * - examId 外键指向 examPapers.id(本仓库 exam_papers 即"考试/试卷"主表,无独立 exams 表)
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  real,
  timestamp,
  jsonb,
  index,
  primaryKey,
  foreignKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { examQuestions, examPapers } from './exam.js'

/**
 * AI 批改记录表(ai_grading_record)。
 *
 * 用于主观题 AI 自动批改,记录 AI 评分/反馈,以及教师后续审核意见。
 * - studentAnswer: 学生原始作答文本
 * - aiScore:       AI 评分(0-100)
 * - aiFeedback:    AI 生成的反馈(优点/不足/建议)
 * - rubric:        评分标准(JSON,如 [{ criterion, weight, maxScore }])
 * - model:         使用的 AI 模型(如 glm-4.6 / gpt-4o)
 * - status:        pending(待审核) / approved(采纳) / rejected(驳回)
 * - teacherReview: 教师审核意见(驳回/修正时填写)
 */
export const aiGradingRecord = pgTable(
  'ai_grading_record',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => examQuestions.id, { onDelete: 'cascade' }),
    examId: uuid('exam_id').references(() => examPapers.id, { onDelete: 'set null' }),
    studentAnswer: text('student_answer').notNull(),
    aiScore: real('ai_score').notNull(),
    aiFeedback: text('ai_feedback').notNull(),
    rubric: jsonb('rubric'),
    model: varchar('model', { length: 100 }),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    teacherReview: text('teacher_review'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    studentIdx: index('ai_grading_record_student_idx').on(t.studentId),
    questionIdx: index('ai_grading_record_question_idx').on(t.questionId),
    examIdx: index('ai_grading_record_exam_idx').on(t.examId),
    statusIdx: index('ai_grading_record_status_idx').on(t.status),
  }),
)

/**
 * AI 出题记录表(ai_generated_question)。
 *
 * AI 根据学科/章节/难度生成的题目,需人工审核后才能进入正式题库。
 * - questionType: choice(选择) / fill(填空) / subjective(主观)
 * - difficulty:   easy / medium / hard
 * - options:      choice 类型的选项数组 [{ key, text }]
 * - knowledgePoints: 关联的知识点 ID 数组 [uuid, ...]
 * - prompt:       生成时使用的 prompt(便于复现/调优)
 * - quality:      pending(待审) / approved(采纳) / rejected(驳回)
 * - humanReview:  人工审核意见
 */
export const aiGeneratedQuestion = pgTable(
  'ai_generated_question',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subject: varchar('subject', { length: 50 }).notNull(),
    chapter: varchar('chapter', { length: 200 }),
    questionType: varchar('question_type', { length: 20 }).notNull(),
    difficulty: varchar('difficulty', { length: 10 }).default('medium').notNull(),
    questionText: text('question_text').notNull(),
    options: jsonb('options'),
    answer: text('answer').notNull(),
    explanation: text('explanation'),
    knowledgePoints: jsonb('knowledge_points'),
    prompt: text('prompt'),
    model: varchar('model', { length: 100 }),
    quality: varchar('quality', { length: 20 }).default('pending').notNull(),
    humanReview: text('human_review'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    subjectIdx: index('ai_generated_question_subject_idx').on(t.subject),
    typeIdx: index('ai_generated_question_type_idx').on(t.questionType),
    difficultyIdx: index('ai_generated_question_difficulty_idx').on(t.difficulty),
    qualityIdx: index('ai_generated_question_quality_idx').on(t.quality),
  }),
)

/**
 * 知识点表(knowledge_points)。
 *
 * 学科/章节下的知识点树形结构,供随机抽题、SRS 复习、AI 出题关联。
 * - subject:      学科(如 math / physics / english)
 * - chapter:      章节(如 "代数 > 一元二次方程")
 * - prerequisites:前置知识点 ID 数组 [uuid, ...]
 * - parentId:     父知识点(树形结构,自引用,onDelete set null)
 */
export const knowledgePoints = pgTable(
  'knowledge_points',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subject: varchar('subject', { length: 50 }).notNull(),
    chapter: varchar('chapter', { length: 200 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    difficulty: varchar('difficulty', { length: 10 }).default('medium').notNull(),
    prerequisites: jsonb('prerequisites'),
    parentId: uuid('parent_id').references((): AnyPgColumn => knowledgePoints.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    subjectIdx: index('knowledge_points_subject_idx').on(t.subject),
    chapterIdx: index('knowledge_points_chapter_idx').on(t.chapter),
    parentIdx: index('knowledge_points_parent_idx').on(t.parentId),
  }),
)

/**
 * LangGraph checkpoints 表(langgraph_checkpoints)。
 *
 * LangGraph 节点级 checkpoint — 持久化每个 thread 的执行状态快照。
 * 复合主键 (thread_id, checkpoint_id),parent_id 指向上一个 checkpoint 形成链。
 * - node_id:  产生该 checkpoint 的节点 ID
 * - state:    LangGraph 状态快照(ChannelState JSON)
 */
export const langgraphCheckpoints = pgTable(
  'langgraph_checkpoints',
  {
    threadId: varchar('thread_id', { length: 100 }).notNull(),
    checkpointId: varchar('checkpoint_id', { length: 100 }).notNull(),
    parentId: varchar('parent_id', { length: 100 }),
    nodeId: varchar('node_id', { length: 200 }).notNull(),
    state: jsonb('state').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.threadId, t.checkpointId] }),
    threadIdx: index('langgraph_checkpoints_thread_idx').on(t.threadId),
    parentIdx: index('langgraph_checkpoints_parent_idx').on(t.parentId),
  }),
)

/**
 * LangGraph writes 表(langgraph_writes)。
 *
 * checkpoint 写入记录 — 每个 task 对各 channel 的增量写入。
 * 复合主键 (thread_id, checkpoint_id, task_id, channel)。
 * 复合外键 (thread_id, checkpoint_id) -> langgraph_checkpoints(thread_id, checkpoint_id)。
 * - value: 写入值(序列化后的 LangGraph ChannelValue)
 */
export const langgraphWrites = pgTable(
  'langgraph_writes',
  {
    threadId: varchar('thread_id', { length: 100 }).notNull(),
    checkpointId: varchar('checkpoint_id', { length: 100 }).notNull(),
    taskId: varchar('task_id', { length: 100 }).notNull(),
    channel: varchar('channel', { length: 200 }).notNull(),
    value: jsonb('value'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.threadId, t.checkpointId, t.taskId, t.channel] }),
    checkpointFk: foreignKey({
      columns: [t.threadId, t.checkpointId],
      foreignColumns: [langgraphCheckpoints.threadId, langgraphCheckpoints.checkpointId],
      name: 'langgraph_writes_checkpoint_fk',
    }),
    threadIdx: index('langgraph_writes_thread_idx').on(t.threadId),
  }),
)

export type AiGradingRecord = typeof aiGradingRecord.$inferSelect
export type NewAiGradingRecord = typeof aiGradingRecord.$inferInsert
export type AiGeneratedQuestion = typeof aiGeneratedQuestion.$inferSelect
export type NewAiGeneratedQuestion = typeof aiGeneratedQuestion.$inferInsert
export type KnowledgePoint = typeof knowledgePoints.$inferSelect
export type NewKnowledgePoint = typeof knowledgePoints.$inferInsert
export type LanggraphCheckpoint = typeof langgraphCheckpoints.$inferSelect
export type NewLanggraphCheckpoint = typeof langgraphCheckpoints.$inferInsert
export type LanggraphWrite = typeof langgraphWrites.$inferSelect
export type NewLanggraphWrite = typeof langgraphWrites.$inferInsert
