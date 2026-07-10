import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

/**
 * 热搜词表。
 * 展示在搜索页面的热门关键词,按 sort 排序,status 控制上下架。
 */
export const hotWords = pgTable('hot_words', {
  id: uuid('id').defaultRandom().primaryKey(),
  word: varchar('word', { length: 100 }).notNull(),
  sort: integer('sort').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 资讯置顶表。
 * 关联 news_articles,按 sort 排序控制置顶展示顺序。
 */
export const newsTops = pgTable('news_tops', {
  id: uuid('id').defaultRandom().primaryKey(),
  newsId: uuid('news_id').notNull(),
  sort: integer('sort').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 资讯推荐表。
 * 关联 news_articles,按 sort 排序控制推荐展示顺序。
 */
export const newsRecommends = pgTable('news_recommends', {
  id: uuid('id').defaultRandom().primaryKey(),
  newsId: uuid('news_id').notNull(),
  sort: integer('sort').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type HotWord = typeof hotWords.$inferSelect;
export type NewHotWord = typeof hotWords.$inferInsert;
export type NewsTop = typeof newsTops.$inferSelect;
export type NewNewsTop = typeof newsTops.$inferInsert;
export type NewsRecommend = typeof newsRecommends.$inferSelect;
export type NewNewsRecommend = typeof newsRecommends.$inferInsert;
