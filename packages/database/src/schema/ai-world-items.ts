import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core'

/**
 * AI World 分类表 - AI 工具集分类(可借鉴 ai-bot.cn 但重命名)。
 */
export const aiWorldCategories = pgTable(
  'ai_world_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    description: varchar('description', { length: 500 }),
    icon: varchar('icon', { length: 100 }),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sortIdx: index('ix_ai_world_categories_sort').on(t.sort),
  }),
)

/**
 * AI World 条目表 - 通用 entry,用 kind 区分:
 * - news: AI 资讯(官方 blog)
 * - paper: AI 论文(arXiv / HF Daily Papers)
 * - project: GitHub 趋势项目
 * - tool: AI 工具
 * - app: AI APP
 */
export const aiWorldItems = pgTable(
  'ai_world_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: varchar('kind', { length: 32 }).notNull(),
    categoryId: uuid('category_id').references(() => aiWorldCategories.id, {
      onDelete: 'set null',
    }),
    slug: varchar('slug', { length: 200 }),
    title: varchar('title', { length: 500 }).notNull(),
    summary: varchar('summary', { length: 1000 }),
    content: text('content'),
    url: varchar('url', { length: 1000 }),
    coverImage: varchar('cover_image', { length: 1000 }),
    authorId: uuid('author_id'),
    source: varchar('source', { length: 200 }).notNull(),
    sourceUrl: varchar('source_url', { length: 1000 }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    viewCount: integer('view_count').default(0).notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('ix_ai_world_items_category').on(t.categoryId),
    kindIdx: index('ix_ai_world_items_kind').on(t.kind),
    sourceIdx: index('ix_ai_world_items_source').on(t.source),
    kindSourceUrlUniq: unique('uq_ai_world_items_kind_source_url').on(t.kind, t.sourceUrl),
  }),
)

/**
 * AI World 同步日志表 - 记录每次 cron 同步的源/状态/条目数/错误。
 */
export const aiWorldSyncLog = pgTable(
  'ai_world_sync_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    source: varchar('source', { length: 200 }).notNull(),
    kind: varchar('kind', { length: 32 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    itemCount: integer('item_count').default(0).notNull(),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sourceIdx: index('ix_ai_world_sync_log_source').on(t.source),
    startedAtIdx: index('ix_ai_world_sync_log_started_at').on(t.startedAt),
  }),
)

export type AiWorldCategory = typeof aiWorldCategories.$inferSelect
export type NewAiWorldCategory = typeof aiWorldCategories.$inferInsert
export type AiWorldItem = typeof aiWorldItems.$inferSelect
export type NewAiWorldItem = typeof aiWorldItems.$inferInsert
export type AiWorldSyncLog = typeof aiWorldSyncLog.$inferSelect
export type NewAiWorldSyncLog = typeof aiWorldSyncLog.$inferInsert
