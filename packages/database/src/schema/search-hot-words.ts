import { pgTable, bigserial, varchar, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'

// 搜索热词表 (2026-07-20 补建,迁移报告 P0 缺失)
// 与 hot_words (misc-extended-2.ts) 并存:本表聚焦搜索统计场景(searchCount + rank),
// hot_words 偏运营展示(sort + status varchar)。前端 apps/web/app/(main)/admin/search-hot-words/page.tsx
// 经 /api/search/hot-words 路由调用,后端 apps/api/src/routes/search.ts 实际操作 hot_words 表;
// 本表为报告 P0 缺失项补建,供后续 search-hot-words 独立查询路径使用。
export const searchHotWords = pgTable(
  'search_hot_words',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    keyword: varchar('keyword', { length: 200 }).notNull(),
    searchCount: integer('search_count').default(0).notNull(),
    rank: integer('rank').default(0).notNull(),
    status: integer('status').default(1).notNull(), // 1-启用 0-禁用
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    keywordUniqueIdx: uniqueIndex('search_hot_words_keyword_idx').on(t.keyword),
    statusIdx: index('search_hot_words_status_idx').on(t.status),
  }),
)

export type SearchHotWord = typeof searchHotWords.$inferSelect
export type NewSearchHotWord = typeof searchHotWords.$inferInsert
