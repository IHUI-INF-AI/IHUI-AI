import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 知识库表。
 * status: 1=启用 0=禁用。
 */
export const knowledgeBase = pgTable(
  'knowledge_base',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    summary: text('summary'),
    content: text('content'),
    coverImage: varchar('cover_image', { length: 500 }),
    categoryId: uuid('category_id'),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    viewCount: integer('view_count').default(0).notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('knowledge_base_category_idx').on(t.categoryId),
    authorIdx: index('knowledge_base_author_idx').on(t.authorId),
  }),
)

export type KnowledgeBase = typeof knowledgeBase.$inferSelect
export type NewKnowledgeBase = typeof knowledgeBase.$inferInsert
