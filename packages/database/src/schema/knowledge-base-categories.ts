import { pgTable, uuid, varchar, integer, timestamp, unique } from 'drizzle-orm/pg-core'

/**
 * 知识库分类表(替代 knowledgeBase.categoryId 的 distinct 查询,支持分类名称展示与排序)。
 */
export const knowledgeBaseCategories = pgTable(
  'knowledge_base_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameIdx: unique('kbc_name_unique').on(t.name),
  }),
)

export type KnowledgeBaseCategory = typeof knowledgeBaseCategories.$inferSelect
export type NewKnowledgeBaseCategory = typeof knowledgeBaseCategories.$inferInsert
