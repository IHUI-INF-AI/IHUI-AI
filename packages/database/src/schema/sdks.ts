import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * SDK 管理表。
 * language: 'typescript' / 'python' / 'java' / 'go' / 'rust' 等。
 * status: 'active'(启用) / 'deprecated'(已弃用) / 'beta'(测试版)。
 */
export const sdks = pgTable(
  'sdks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    version: varchar('version', { length: 32 }).notNull(),
    language: varchar('language', { length: 32 }).notNull(),
    downloadUrl: varchar('download_url', { length: 512 }),
    documentationUrl: varchar('documentation_url', { length: 512 }),
    description: text('description'),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    languageIdx: index('sdks_language_idx').on(t.language),
    statusIdx: index('sdks_status_idx').on(t.status),
  }),
)

export type Sdk = typeof sdks.$inferSelect
export type NewSdk = typeof sdks.$inferInsert
