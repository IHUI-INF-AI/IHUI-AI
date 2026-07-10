import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 搜索索引表（通用全文索引）。
 * - targetType: agent / course / article / news / question / post 等。
 * - targetId: 目标业务 id（字符串存储以兼容历史 bigint）。
 * - weight: 权重，用于排序。
 * - status: 0=下线 1=上线。
 */
export const searchIndex = pgTable(
  'search_index',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    targetType: varchar('target_type', { length: 50 }).notNull(),
    targetId: varchar('target_id', { length: 64 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    content: text('content'),
    keywords: varchar('keywords', { length: 500 }),
    category: varchar('category', { length: 100 }),
    tags: varchar('tags', { length: 500 }),
    cover: varchar('cover', { length: 500 }),
    url: varchar('url', { length: 500 }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    userName: varchar('user_name', { length: 100 }),
    weight: integer('weight').default(0).notNull(),
    viewNum: integer('view_num').default(0).notNull(),
    likeNum: integer('like_num').default(0).notNull(),
    commentNum: integer('comment_num').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    isTop: boolean('is_top').default(false).notNull(),
    isEssence: boolean('is_essence').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    targetIdx: index('search_index_target_idx').on(t.targetType, t.targetId),
    categoryIdx: index('search_index_category_idx').on(t.category),
    statusIdx: index('search_index_status_idx').on(t.status),
    userIdx: index('search_index_user_idx').on(t.userId),
  }),
);

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
);

export type SearchIndex = typeof searchIndex.$inferSelect;
export type NewSearchIndex = typeof searchIndex.$inferInsert;
export type SearchHotKeyword = typeof searchHotKeywords.$inferSelect;
export type NewSearchHotKeyword = typeof searchHotKeywords.$inferInsert;
