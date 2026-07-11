import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 用户端工具目录表。
 * status: 'published'(已发布) / 'draft'(草稿) / 'offline'(已下架)。
 * rating: 评分（0-500，除以 100 为显示值）；favorite_count 收藏数；sort_order 排序值。
 */
export const tools = pgTable(
  'tools',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 64 }).notNull(),
    icon: varchar('icon', { length: 512 }),
    url: varchar('url', { length: 512 }),
    rating: integer('rating').default(0).notNull(),
    favoriteCount: integer('favorite_count').default(0).notNull(),
    status: varchar('status', { length: 20 }).default('published').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index('tools_category_idx').on(t.category),
    statusIdx: index('tools_status_idx').on(t.status),
  }),
)

/**
 * 工具收藏记录表。
 * (user_id, tool_id) 联合唯一：同一用户对同一工具仅一条收藏。
 */
export const toolFavorites = pgTable(
  'tool_favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    toolId: uuid('tool_id')
      .references(() => tools.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userToolIdx: index('tool_favorites_user_tool_idx').on(t.userId, t.toolId),
  }),
)

export type Tool = typeof tools.$inferSelect
export type NewTool = typeof tools.$inferInsert
export type ToolFavorite = typeof toolFavorites.$inferSelect
export type NewToolFavorite = typeof toolFavorites.$inferInsert
