import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  real,
  timestamp,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 旅游内容表（tour_content）。
 * - status: draft / pending_review / published / offline。
 * - type: route(路线) / scenic(景点) / hotel(酒店) / strategy(攻略)。
 * - tags: 标签数组（jsonb）。
 * - release_stage: 灰度发布阶段（off / canary_1pct / canary_5pct / canary_25pct / full）。
 */
export const tourContent = pgTable(
  'tour_content',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    type: varchar('type', { length: 32 }).default('route').notNull(),
    summary: text('summary'),
    content: text('content').notNull(),
    coverImage: varchar('cover_image', { length: 512 }),
    tags: jsonb('tags').notNull().default([]),
    destination: varchar('destination', { length: 200 }),
    duration: integer('duration'),
    price: integer('price'),
    status: varchar('status', { length: 32 }).default('draft').notNull(),
    releaseStage: varchar('release_stage', { length: 32 }).default('off').notNull(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    viewCount: integer('view_count').default(0).notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('tour_content_status_idx').on(t.status),
    typeIdx: index('tour_content_type_idx').on(t.type),
    destinationIdx: index('tour_content_destination_idx').on(t.destination),
  }),
)

/**
 * 旅游推荐记录表（tour_recommendations）。
 * - 由推荐算法填充：根据用户画像 + 内容特征匹配。
 * - score: 推荐分数（0~1，越大越推荐）。
 * - reason: 推荐理由（jsonb 数组，如 ['hot', 'nearby', 'similar_user']）。
 */
export const tourRecommendations = pgTable(
  'tour_recommendations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    contentId: uuid('content_id')
      .references(() => tourContent.id, { onDelete: 'cascade' })
      .notNull(),
    score: real('score').notNull(),
    reason: jsonb('reason').notNull().default([]),
    strategy: varchar('strategy', { length: 32 }).default('default').notNull(),
    clicked: boolean('clicked').default(false).notNull(),
    dismissed: boolean('dismissed').default(false).notNull(),
    servedAt: timestamp('served_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('tour_recommendations_user_idx').on(t.userId),
    contentIdx: index('tour_recommendations_content_idx').on(t.contentId),
    userStrategyUniq: unique('tour_recommendations_user_content_strategy_uniq').on(
      t.userId,
      t.contentId,
      t.strategy,
    ),
  }),
)

/**
 * 旅游依赖关系表（tour_dependencies）。
 * 记录内容之间的依赖：A 依赖 B 才能上线 / 下线。
 * - relation_type: requires(强依赖) / suggests(建议) / conflicts(互斥)。
 */
export const tourDependencies = pgTable(
  'tour_dependencies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contentId: uuid('content_id')
      .references(() => tourContent.id, { onDelete: 'cascade' })
      .notNull(),
    dependsOnId: uuid('depends_on_id')
      .references(() => tourContent.id, { onDelete: 'cascade' })
      .notNull(),
    relationType: varchar('relation_type', { length: 32 }).default('requires').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    contentIdx: index('tour_dependencies_content_idx').on(t.contentId),
    dependsOnIdx: index('tour_dependencies_depends_on_idx').on(t.dependsOnId),
    pairUniq: unique('tour_dependencies_pair_uniq').on(t.contentId, t.dependsOnId, t.relationType),
  }),
)

/**
 * 旅游事件总线表（tour_events）。
 * 复用 outbox 模式：业务事务内写事件，独立 worker 异步分发到下游（多平台/监控/告警）。
 * - status: pending / processed / failed。
 * - type: content.published / content.offline / recommendation.served 等。
 */
export const tourEvents = pgTable(
  'tour_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: varchar('type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    status: varchar('status', { length: 32 }).default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lastError: text('last_error'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('tour_events_status_idx').on(t.status),
    typeIdx: index('tour_events_type_idx').on(t.type),
  }),
)

export type TourContent = typeof tourContent.$inferSelect
export type NewTourContent = typeof tourContent.$inferInsert
export type TourRecommendation = typeof tourRecommendations.$inferSelect
export type NewTourRecommendation = typeof tourRecommendations.$inferInsert
export type TourDependency = typeof tourDependencies.$inferSelect
export type NewTourDependency = typeof tourDependencies.$inferInsert
export type TourEvent = typeof tourEvents.$inferSelect
export type NewTourEvent = typeof tourEvents.$inferInsert
