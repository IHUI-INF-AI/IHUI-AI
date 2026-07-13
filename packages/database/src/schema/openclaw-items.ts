import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * OpenClaw 条目表 - 开放爪类内容条目。
 */
export const openclawItems = pgTable(
  'openclaw_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content'),
    coverImage: varchar('cover_image', { length: 500 }),
    authorId: uuid('author_id'),
    viewCount: integer('view_count').default(0).notNull(),
    status: integer('status').default(1).notNull(), // 1=启用 0=禁用
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    authorIdx: index('openclaw_items_author_idx').on(t.authorId),
  }),
)

export type OpenclawItem = typeof openclawItems.$inferSelect
export type NewOpenclawItem = typeof openclawItems.$inferInsert
