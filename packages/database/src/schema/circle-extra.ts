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
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { circles, circlePosts } from './community.js';

/**
 * 圈子分类表。
 * - pid: 父分类 id，0/NULL 表示顶级。
 * - sortOrder: 排序序号，值小靠前。
 * - isShow: 是否在前台展示。
 */
export const circleCategories = pgTable(
  'circle_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pid: uuid('pid'),
    name: varchar('name', { length: 100 }).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isShow: boolean('is_show').default(true).notNull(),
    icon: varchar('icon', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pidIdx: index('circle_categories_pid_idx').on(t.pid),
  }),
);

/**
 * 圈子成员表。
 * - role: owner / admin / member。
 * - status: 0=已退出 1=正常。
 */
export const circleMembers = pgTable(
  'circle_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    circleId: uuid('circle_id')
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).default('member').notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    circleIdx: index('circle_members_circle_idx').on(t.circleId),
    userIdx: index('circle_members_user_idx').on(t.userId),
    statusIdx: index('circle_members_status_idx').on(t.status),
    uniq: unique('circle_member_user_uniq').on(t.circleId, t.userId),
  }),
);

/**
 * 圈子帖子点赞表。
 */
export const circlePostLikes = pgTable(
  'circle_post_likes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => circlePosts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    postIdx: index('circle_post_likes_post_idx').on(t.postId),
    userIdx: index('circle_post_likes_user_idx').on(t.userId),
    uniq: unique('circle_post_like_uniq').on(t.postId, t.userId),
  }),
);

/**
 * 圈子帖子评论表。
 * - pid: 父评论 id，NULL 表示顶级评论。
 * - replyUserId: 被回复用户 id。
 */
export const circlePostComments = pgTable(
  'circle_post_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => circlePosts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    pid: uuid('pid'),
    replyUserId: uuid('reply_user_id').references(() => users.id, { onDelete: 'set null' }),
    likeCount: integer('like_count').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    postIdx: index('circle_post_comments_post_idx').on(t.postId),
    userIdx: index('circle_post_comments_user_idx').on(t.userId),
    pidIdx: index('circle_post_comments_pid_idx').on(t.pid),
  }),
);

export type CircleCategory = typeof circleCategories.$inferSelect;
export type NewCircleCategory = typeof circleCategories.$inferInsert;
export type CircleMember = typeof circleMembers.$inferSelect;
export type NewCircleMember = typeof circleMembers.$inferInsert;
export type CirclePostLike = typeof circlePostLikes.$inferSelect;
export type NewCirclePostLike = typeof circlePostLikes.$inferInsert;
export type CirclePostComment = typeof circlePostComments.$inferSelect;
export type NewCirclePostComment = typeof circlePostComments.$inferInsert;
