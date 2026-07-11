import { pgTable, uuid, varchar, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 小程序配置表。
 * 每个小程序（以 app_id 标识）一行配置。config 为业务自定义配置（jsonb）。
 * status: 'active'(启用) / 'disabled'(已禁用)。
 */
export const miniprogramConfigs = pgTable(
  'miniprogram_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    appId: varchar('app_id', { length: 64 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    config: jsonb('config').notNull().default({}),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('miniprogram_configs_status_idx').on(t.status),
  }),
)

/**
 * 小程序版本表。
 * version: 版本号。version_desc: 版本描述。qrcode_url: 体验版/预览版二维码。
 * status: 'preview'(预览) / 'released'(已发布) / 'rejected'(已驳回)。
 */
export const miniprogramVersions = pgTable(
  'miniprogram_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    appId: varchar('app_id', { length: 64 }).notNull(),
    version: varchar('version', { length: 32 }).notNull(),
    versionDesc: varchar('version_desc', { length: 500 }),
    qrcodeUrl: varchar('qrcode_url', { length: 512 }),
    status: varchar('status', { length: 20 }).default('preview').notNull(),
    build: integer('build').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    appIdx: index('miniprogram_versions_app_idx').on(t.appId),
    statusIdx: index('miniprogram_versions_status_idx').on(t.status),
  }),
)

export type MiniprogramConfig = typeof miniprogramConfigs.$inferSelect
export type NewMiniprogramConfig = typeof miniprogramConfigs.$inferInsert
export type MiniprogramVersion = typeof miniprogramVersions.$inferSelect
export type NewMiniprogramVersion = typeof miniprogramVersions.$inferInsert
