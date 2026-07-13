import { pgTable, uuid, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 技能表。
 * status: 1=启用 0=禁用。
 */
export const skills = pgTable('skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 500 }),
  categoryId: uuid('category_id'),
  difficulty: integer('difficulty').default(1).notNull(),
  content: text('content'),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  isPublished: boolean('is_published').default(false).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Skill = typeof skills.$inferSelect
export type NewSkill = typeof skills.$inferInsert
