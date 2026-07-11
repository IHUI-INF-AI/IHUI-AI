import { pgTable, uuid, varchar, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 开发者 API 密钥表。
 * status: 'active'(启用) / 'revoked'(已吊销)。
 * permissions: 权限点列表（jsonb 数组）。rate_limit: 每分钟请求上限。
 * key: 公开标识（前缀+短码）；secret: 仅创建时返回完整值，存储需哈希。
 */
export const developerApiKeys = pgTable(
  'developer_api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    key: varchar('key', { length: 128 }).notNull().unique(),
    secret: varchar('secret', { length: 255 }).notNull(),
    permissions: jsonb('permissions').notNull().default([]),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    rateLimit: integer('rate_limit').default(60).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('developer_api_keys_user_idx').on(t.userId),
    keyIdx: index('developer_api_keys_key_idx').on(t.key),
  }),
)

export type DeveloperApiKey = typeof developerApiKeys.$inferSelect
export type NewDeveloperApiKey = typeof developerApiKeys.$inferInsert
