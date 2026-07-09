import { pgTable, uuid, varchar, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 资讯分类表。
 */
export const newsCategories = pgTable(
  'news_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(), // 1=启用 0=禁用
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ sortIdx: index('news_categories_sort_idx').on(t.sort) }),
);

/**
 * 资讯文章表。
 * status: 0=草稿 1=已发布。
 */
export const newsArticles = pgTable(
  'news_articles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id').references(() => newsCategories.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 200 }).notNull(),
    summary: varchar('summary', { length: 500 }),
    content: text('content').notNull(),
    coverImage: varchar('cover_image', { length: 512 }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: varchar('author_name', { length: 100 }),
    isPublished: boolean('is_published').default(false).notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(0).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('news_articles_category_idx').on(t.categoryId),
    pubIdx: index('news_articles_published_idx').on(t.isPublished),
  }),
);

export type NewsCategory = typeof newsCategories.$inferSelect;
export type NewNewsCategory = typeof newsCategories.$inferInsert;
export type NewsArticle = typeof newsArticles.$inferSelect;
export type NewNewsArticle = typeof newsArticles.$inferInsert;
