import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 圈子(社区)表。
 * - slug: URL 友好标识，全局唯一。
 * - memberCount/postCount: 冗余计数，由业务层维护。
 * - isPublished: 是否对外可见。
 * - createdBy: 创建者，删除用户时置 NULL。
 */
export const circles = pgTable('circles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  description: text('description'),
  coverImage: varchar('cover_image', { length: 512 }),
  categoryId: uuid('category_id'),
  cidList: jsonb('cid_list').$type<string[]>(),
  memberCount: integer('member_count').default(0).notNull(),
  postCount: integer('post_count').default(0).notNull(),
  isPublished: boolean('is_published').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 圈子帖子表。
 * - images: URL 数组(jsonb)。
 * - status: 1=正常, 0=隐藏, -1=删除。
 * - isPinned: 是否置顶。
 */
export const circlePosts = pgTable('circle_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  circleId: uuid('circle_id')
    .notNull()
    .references(() => circles.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  images: jsonb('images').$type<string[]>(),
  viewCount: integer('view_count').default(0).notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  replyCount: integer('reply_count').default(0).notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 问答表。
 * - tags: 标签名数组(jsonb)。
 * - isResolved: 是否已解决(有被采纳的答案)。
 * - status: 1=正常, 0=隐藏, -1=删除。
 */
export const asks = pgTable('asks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  tags: jsonb('tags').$type<string[]>(),
  viewCount: integer('view_count').default(0).notNull(),
  answerCount: integer('answer_count').default(0).notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  isResolved: boolean('is_resolved').default(false).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 问答回答表。
 * - isAccepted: 是否被采纳为最佳答案。
 * - status: 1=正常, 0=隐藏, -1=删除。
 */
export const askAnswers = pgTable('ask_answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  askId: uuid('ask_id')
    .notNull()
    .references(() => asks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  isAccepted: boolean('is_accepted').default(false).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Circle = typeof circles.$inferSelect
export type NewCircle = typeof circles.$inferInsert
export type CirclePost = typeof circlePosts.$inferSelect
export type NewCirclePost = typeof circlePosts.$inferInsert
export type Ask = typeof asks.$inferSelect
export type NewAsk = typeof asks.$inferInsert
export type AskAnswer = typeof askAnswers.$inferSelect
export type NewAskAnswer = typeof askAnswers.$inferInsert
