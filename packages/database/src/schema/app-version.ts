import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

/**
 * 应用版本管理表。
 * platform: 'ios' / 'android' / 'web' / 'harmony'。
 * build_number: 构建号（单调递增）。force_update: 是否强制更新。
 * release_notes: 版本说明（多平台可存 jsonb，此处用 text 兼容纯文本）。
 * status: 'latest'(最新) / 'history'(历史) / 'disabled'(已禁用)。
 */
export const appVersions = pgTable(
  'app_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    version: varchar('version', { length: 32 }).notNull(),
    platform: varchar('platform', { length: 16 }).notNull(),
    buildNumber: integer('build_number').notNull(),
    downloadUrl: varchar('download_url', { length: 512 }),
    forceUpdate: boolean('force_update').default(false).notNull(),
    releaseNotes: text('release_notes'),
    status: varchar('status', { length: 20 }).default('history').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    platformIdx: index('app_versions_platform_idx').on(t.platform),
    statusIdx: index('app_versions_status_idx').on(t.status),
  }),
)

export type AppVersion = typeof appVersions.$inferSelect
export type NewAppVersion = typeof appVersions.$inferInsert
