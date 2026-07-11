import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * 新闻爬虫数据源表（news_crawler_sources）。
 * - source_type: rss / html / api / json。
 * - schedule_cron: 调度 cron 表达式（5 字段）。
 * - selector_config: CSS/XPath/JSON 提取规则（jsonb）。
 * - status: active / paused / error。
 */
export const newsCrawlerSources = pgTable(
  'news_crawler_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull().unique(),
    url: varchar('url', { length: 1000 }).notNull(),
    sourceType: varchar('source_type', { length: 32 }).default('rss').notNull(),
    scheduleCron: varchar('schedule_cron', { length: 64 }).default('0 * * * *').notNull(),
    selectorConfig: jsonb('selector_config').notNull().default({}),
    status: varchar('status', { length: 32 }).default('active').notNull(),
    lastFetchAt: timestamp('last_fetch_at', { withTimezone: true }),
    lastFetchStatus: varchar('last_fetch_status', { length: 32 }),
    lastFetchCount: integer('last_fetch_count'),
    lastError: text('last_error'),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('news_crawler_sources_status_idx').on(t.status),
    enabledIdx: index('news_crawler_sources_enabled_idx').on(t.enabled),
  }),
)

/**
 * 新闻爬虫抓取的文章表（news_crawler_articles）。
 * - (source_id + original_url) 唯一，避免重复入库。
 * - dedupe_hash: 内容指纹（用于跨源去重）。
 * - status: pending / stored / discarded。
 */
export const newsCrawlerArticles = pgTable(
  'news_crawler_articles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceId: uuid('source_id')
      .references(() => newsCrawlerSources.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    summary: text('summary'),
    content: text('content'),
    originalUrl: varchar('original_url', { length: 1000 }).notNull(),
    author: varchar('author', { length: 200 }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    coverImage: varchar('cover_image', { length: 1000 }),
    tags: jsonb('tags').notNull().default([]),
    dedupeHash: varchar('dedupe_hash', { length: 64 }),
    status: varchar('status', { length: 32 }).default('stored').notNull(),
    rawPayload: jsonb('raw_payload'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sourceIdx: index('news_crawler_articles_source_idx').on(t.sourceId),
    statusIdx: index('news_crawler_articles_status_idx').on(t.status),
    dedupeIdx: index('news_crawler_articles_dedupe_idx').on(t.dedupeHash),
    sourceUrlUniq: unique('news_crawler_articles_source_url_uniq').on(t.sourceId, t.originalUrl),
  }),
)

export type NewsCrawlerSource = typeof newsCrawlerSources.$inferSelect
export type NewNewsCrawlerSource = typeof newsCrawlerSources.$inferInsert
export type NewsCrawlerArticle = typeof newsCrawlerArticles.$inferSelect
export type NewNewsCrawlerArticle = typeof newsCrawlerArticles.$inferInsert
