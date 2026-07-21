import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  unique,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 评论表。
 * - resourceType: 'project' | 'file' | 'doc' | 'post'（varchar 避免 pg enum 兼容问题）。
 * - parentId: 父评论 ID，null 表示顶级评论，自引用 cascade。
 * - mentions: @用户 ID 数组（jsonb）。
 * - isDeleted: 软删除标记；软删除后 content 应替换为"已删除"。
 */
export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  resourceType: varchar('resource_type', { length: 32 }).notNull(),
  resourceId: varchar('resource_id', { length: 128 }).notNull(),
  parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, {
    onDelete: 'cascade',
  }),
  content: text('content').notNull(),
  mentions: jsonb('mentions').$type<string[]>(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 评论点赞表。
 * - (comment_id, user_id) 联合唯一，保证同一用户对同一评论只能点赞一次。
 */
export const commentLikes = pgTable(
  'comment_likes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    commentId: uuid('comment_id')
      .references(() => comments.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    commentLikeUnique: unique().on(t.commentId, t.userId),
  }),
)

/**
 * 用户反馈表。
 * - type: 'bug' | 'feature' | 'improvement' | 'other'。
 * - status: 'pending' | 'reviewing' | 'resolved' | 'closed'。
 * - priority: 'low' | 'medium' | 'high'。
 * - rating: 0-5 用户对处理结果的评价（0=未评价）。
 */
export const feedbacks = pgTable('feedbacks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  type: varchar('type', { length: 32 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  contact: varchar('contact', { length: 255 }),
  status: varchar('status', { length: 32 }).default('pending').notNull(),
  priority: varchar('priority', { length: 16 }).default('medium').notNull(),
  adminReply: text('admin_reply'),
  rating: integer('rating').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert
export type CommentLike = typeof commentLikes.$inferSelect
export type NewCommentLike = typeof commentLikes.$inferInsert
export type Feedback = typeof feedbacks.$inferSelect
export type NewFeedback = typeof feedbacks.$inferInsert
