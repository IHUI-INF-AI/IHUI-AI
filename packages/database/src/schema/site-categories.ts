import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core'

/**
 * 站点分类表 - 通用站点分类(按 type 区分模块)。
 */
export const siteCategories = pgTable('site_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  icon: varchar('icon', { length: 500 }),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(), // 1=启用 0=禁用
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type SiteCategory = typeof siteCategories.$inferSelect
export type NewSiteCategory = typeof siteCategories.$inferInsert
