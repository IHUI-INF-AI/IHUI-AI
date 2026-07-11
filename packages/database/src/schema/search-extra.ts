import { pgTable, uuid, varchar, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 热搜词表。
 * - status: 0=下线 1=上线。
 * - isHot: 是否热门（前台红标展示）。
 */
export const searchHotKeywords = pgTable(
  'search_hot_keywords',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    keyword: varchar('keyword', { length: 100 }).notNull(),
    searchCount: integer('search_count').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isHot: boolean('is_hot').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('search_hot_keywords_status_idx').on(t.status),
    keywordIdx: index('search_hot_keywords_keyword_idx').on(t.keyword),
  }),
)

export type SearchHotKeyword = typeof searchHotKeywords.$inferSelect
export type NewSearchHotKeyword = typeof searchHotKeywords.$inferInsert
