// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 问答分类表。
 * - pid: 父分类 id，NULL 表示顶级。
 * - level: 分类级别（1=顶级）。
 * - isShowIndex: 是否在首页展示。
 */
export const askCategories = pgTable(
  'ask_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pid: uuid('pid'),
    name: varchar('name', { length: 100 }).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isShow: boolean('is_show').default(true).notNull(),
    isShowIndex: boolean('is_show_index').default(false).notNull(),
    image: varchar('image', { length: 500 }),
    level: integer('level').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pidIdx: index('ask_categories_pid_idx').on(t.pid),
  }),
)

/**
 * 问题-分类多对多关联表。
 */

/**
 * 问答点赞表（通用：问题/回答）。
 * - targetType: 'question' | 'answer'。
 * - isLike: true=点赞 false=取消(保留记录)。
 */
export const askLikes = pgTable(
  'ask_likes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 20 }).notNull(),
    targetId: uuid('target_id').notNull(),
    isLike: boolean('is_like').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('ask_likes_user_target_idx').on(t.userId, t.targetType, t.targetId),
    targetIdx: index('ask_likes_target_idx').on(t.targetType, t.targetId),
  }),
)

/**
 * 问答收藏表（通用：问题/回答）。
 * - targetType: 'question' | 'answer'。
 */
export const askFavorites = pgTable(
  'ask_favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 20 }).notNull(),
    targetId: uuid('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('ask_favorites_user_target_idx').on(t.userId, t.targetType, t.targetId),
    targetIdx: index('ask_favorites_target_idx').on(t.targetType, t.targetId),
    uniq: unique('ask_favorite_uniq').on(t.userId, t.targetType, t.targetId),
  }),
)

/**
 * 问答评论表（对问题/回答评论）。
 * - targetType: 'question' | 'answer'。
 * - pid: 父评论 id，NULL 表示顶级评论。
 */
export const askComments = pgTable(
  'ask_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    targetType: varchar('target_type', { length: 20 }).notNull(),
    targetId: uuid('target_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    pid: uuid('pid'),
    likeCount: integer('like_count').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    targetIdx: index('ask_comments_target_idx').on(t.targetType, t.targetId),
    userIdx: index('ask_comments_user_idx').on(t.userId),
    pidIdx: index('ask_comments_pid_idx').on(t.pid),
  }),
)

export type AskCategory = typeof askCategories.$inferSelect
export type NewAskCategory = typeof askCategories.$inferInsert
export type AskLike = typeof askLikes.$inferSelect
export type NewAskLike = typeof askLikes.$inferInsert
export type AskFavorite = typeof askFavorites.$inferSelect
export type NewAskFavorite = typeof askFavorites.$inferInsert
export type AskComment = typeof askComments.$inferSelect
export type NewAskComment = typeof askComments.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
