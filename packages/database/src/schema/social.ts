import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 用户关注表。
 * - (follower_id, following_id) 联合唯一，保证不重复关注。
 * - 幂等：关注时 ON CONFLICT DO NOTHING。
 */
export const userFollows = pgTable(
  'user_follows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    followerId: uuid('follower_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    followingId: uuid('following_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userFollowUnique: unique().on(t.followerId, t.followingId),
  }),
);

/**
 * 用户收藏表。
 * - resource_type: 'project' | 'file' | 'doc' | 'post' | 'comment'。
 * - (user_id, resource_type, resource_id) 联合唯一。
 */
export const userFavorites = pgTable(
  'user_favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    resourceType: varchar('resource_type', { length: 32 }).notNull(),
    resourceId: varchar('resource_id', { length: 128 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userFavoriteUnique: unique().on(t.userId, t.resourceType, t.resourceId),
  }),
);

/**
 * 订阅表。
 * - target_type: 'user' | 'project' | 'tag' | 'category'。
 * - (user_id, target_type, target_id) 联合唯一。
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    targetType: varchar('target_type', { length: 32 }).notNull(),
    targetId: varchar('target_id', { length: 128 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    subscriptionUnique: unique().on(t.userId, t.targetType, t.targetId),
  }),
);

/**
 * 标签表（通用、多资源类型）。
 * - name / slug 全局唯一；slug 由 name 自动生成。
 * - usage_count 由 tag_relations 的 attach(+1)/detach(-1) 维护。
 * - color 为 hex 颜色字符串，可空。
 */
export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 64 }).notNull().unique(),
  slug: varchar('slug', { length: 96 }).notNull().unique(),
  description: text('description'),
  color: varchar('color', { length: 16 }),
  usageCount: integer('usage_count').default(0).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 标签关联表（多资源类型）。
 * - resource_type: 'project' | 'file' | 'doc' | 'post' | 'comment'。
 * - (tag_id, resource_type, resource_id) 联合唯一。
 */
export const tagRelations = pgTable(
  'tag_relations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tagId: uuid('tag_id')
      .references(() => tags.id, { onDelete: 'cascade' })
      .notNull(),
    resourceType: varchar('resource_type', { length: 32 }).notNull(),
    resourceId: varchar('resource_id', { length: 128 }).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tagRelationUnique: unique().on(t.tagId, t.resourceType, t.resourceId),
  }),
);

export type UserFollow = typeof userFollows.$inferSelect;
export type NewUserFollow = typeof userFollows.$inferInsert;
export type UserFavorite = typeof userFavorites.$inferSelect;
export type NewUserFavorite = typeof userFavorites.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type TagRelation = typeof tagRelations.$inferSelect;
export type NewTagRelation = typeof tagRelations.$inferInsert;
