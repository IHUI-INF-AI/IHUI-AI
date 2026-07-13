import { pgTable, serial, uuid, varchar, timestamp, unique, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 资源点赞/收藏表。
 * - resourceType: 'article' | 'resource' | 'knowledge' | 'article_favorite'（varchar 避免 pg enum 兼容问题）。
 * - resourceId: 资源 ID（varchar 兼容 uuid/数字等）。
 * - (resource_type, resource_id, user_id) 联合唯一，保证同一用户对同一资源仅一条记录。
 */
export const resourceLikes = pgTable(
  'resource_likes',
  {
    id: serial('id').primaryKey(),
    resourceType: varchar('resource_type', { length: 50 }).notNull(),
    resourceId: varchar('resource_id', { length: 100 }).notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    resourceLikeUnique: unique('resource_likes_unique').on(t.resourceType, t.resourceId, t.userId),
    userIdIdx: index('resource_likes_user_id_idx').on(t.userId),
  }),
)

export type ResourceLike = typeof resourceLikes.$inferSelect
export type NewResourceLike = typeof resourceLikes.$inferInsert
