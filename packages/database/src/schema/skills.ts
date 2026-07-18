import { pgTable, uuid, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 技能表。
 * status: 1=启用 0=禁用。
 *
 * 同步字段(0107 migration):
 *   - slug           — (authorId, slug) 唯一定位,CLI push/pull 使用
 *   - contentHash    — content 的 SHA-256,快速跳过未变更
 *   - lastSyncedAt   — 最近同步时间,增量同步
 *   - syncSource     — 'web' | 'cli' | 'api'
 *
 * 软删除字段(0110 migration):
 *   - deletedAt      — tombstone,不为空表示已软删除,多端同步删除语义
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
  // 同步字段(0107)
  slug: varchar('slug', { length: 100 }),
  contentHash: varchar('content_hash', { length: 64 }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  syncSource: varchar('sync_source', { length: 20 }).default('web'),
  // 软删除(tombstone):多端同步删除语义
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Skill = typeof skills.$inferSelect
export type NewSkill = typeof skills.$inferInsert
