/**
 * D3 edu Java 题库知识点表补迁移 schema(supplement)。
 *
 * 1 张表(本文件新增):
 *   1. t_knowledge_point  知识点(树形结构,parent_id 自引用)
 *
 * 题库其余 5 表已等价实现,不在本文件重复定义:
 *   - t_question        → examQuestions(exam.ts,字段 id/paperId/type/title/options[jsonb]/answer[jsonb]/analysis/score/difficulty/knowledgePointIds/sortOrder/createdAt)
 *   - t_question_option → examQuestions.options 内联(jsonb:[{key,text}],is_correct 由 answer 标记)
 *   - t_question_answer → examRecords.answers 内联(jsonb:[{questionId,answer,isCorrect}],userId 表级)
 *   - t_chapter         → examChapters(exam-extended.ts,考试章节)
 *   - t_section         → examChapterSections(exam-extended.ts,考试小节)
 *
 * 注:knowledge_base.ts / knowledge-graph.ts / knowledge-rag.ts 是知识库/知识图谱/RAG,
 * 与"题库知识点"(学科考点树)语义不同,不能替代。
 *
 * 主键用 bigserial(与 D3 edu Java bigint AUTO_INCREMENT 对齐)。
 */
import { pgTable, bigserial, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 知识点表(D3 edu Java: t_knowledge_point)
 * 树形结构:parent_id 自引用指向父知识点(0 表示根节点)。
 */
export const tKnowledgePoint = pgTable(
  't_knowledge_point',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    parentId: bigserial('parent_id', { mode: 'number' }).default(0).notNull(),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    parentIdx: index('t_knowledge_point_parent_idx').on(t.parentId),
  }),
)

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type TKnowledgePoint = typeof tKnowledgePoint.$inferSelect
export type NewTKnowledgePoint = typeof tKnowledgePoint.$inferInsert
