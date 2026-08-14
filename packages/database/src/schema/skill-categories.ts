import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 技能分类表 (skill_categories)。
 * 管理 AI 技能的分类目录（名称/英文 slug/图标/排序），供前端技能分类管理页使用。
 */
export const skillCategories = pgTable(
  'skill_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    icon: varchar('icon', { length: 50 }),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: index('ix_skill_categories_slug').on(t.slug),
    sortIdx: index('ix_skill_categories_sort').on(t.sort),
  }),
)

export type SkillCategory = typeof skillCategories.$inferSelect
export type NewSkillCategory = typeof skillCategories.$inferInsert
