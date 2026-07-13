import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * AI World 分类表 - AI 资讯/导航分类。
 */
export const aiWorldCategories = pgTable(
  'ai_world_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    icon: varchar('icon', { length: 500 }),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
  },
  (t) => ({
    sortIdx: index('ix_ai_world_categories_sort').on(t.sort),
  }),
)

/**
 * AI World 条目表 - 分类下的具体 AI 资讯条目。
 */
export const aiWorldItems = pgTable(
  'ai_world_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id').references(() => aiWorldCategories.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content'),
    coverImage: varchar('cover_image', { length: 500 }),
    authorId: uuid('author_id'),
    viewCount: integer('view_count').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('ix_ai_world_items_category').on(t.categoryId),
  }),
)

export type AiWorldCategory = typeof aiWorldCategories.$inferSelect
export type NewAiWorldCategory = typeof aiWorldCategories.$inferInsert
export type AiWorldItem = typeof aiWorldItems.$inferSelect
export type NewAiWorldItem = typeof aiWorldItems.$inferInsert
