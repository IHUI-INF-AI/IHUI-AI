import { pgTable, serial, varchar, integer, text, timestamp, boolean } from 'drizzle-orm/pg-core'

/** 教育平台对接配置（等价自 education_platform.py EducationPlatform） */
export const educationPlatform = pgTable('education_platform', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  type: varchar('type', { length: 20 }).default('mooc'),
  apiUrl: varchar('api_url', { length: 500 }),
  apiKey: varchar('api_key', { length: 200 }),
  apiSecret: varchar('api_secret', { length: 200 }),
  config: text('config'),
  syncUrl: varchar('sync_url', { length: 500 }),
  lastSyncTime: timestamp('last_sync_time', { withTimezone: true }),
  status: integer('status').default(1),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 教育平台同步日志（等价自 education_platform.py EducationSyncLog） */
export const educationSyncLog = pgTable('education_sync_log', {
  id: serial('id').primaryKey(),
  platformCode: varchar('platform_code', { length: 50 }).notNull(),
  type: varchar('type', { length: 20 }).default('course'),
  syncType: varchar('sync_type', { length: 20 }).default('pull'),
  success: boolean('success').default(false),
  request: text('request'),
  response: text('response'),
  errorMsg: varchar('error_msg', { length: 500 }),
  recordCount: integer('record_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type EducationPlatform = typeof educationPlatform.$inferSelect
export type NewEducationPlatform = typeof educationPlatform.$inferInsert
export type EducationSyncLog = typeof educationSyncLog.$inferSelect
export type NewEducationSyncLog = typeof educationSyncLog.$inferInsert
