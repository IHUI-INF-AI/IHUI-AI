import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 下载事件表 (download_events) — 2026-08-06 新增。
 *
 * 记录用户点击下载按钮的事件,供管理员查询统计下载量。
 * userId 为 null 表示匿名用户(未登录也记录,不阻断下载点击)。
 * platform: web / desktop / ios / android-apk / mobile / wechat-miniapp / extension / cli
 * source: sidebar / detail_page
 */
export const downloadEvents = pgTable(
  'download_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 用户 ID,null 表示匿名用户 */
    userId: varchar('user_id', { length: 32 }),
    /** 下载平台 */
    platform: varchar('platform', { length: 32 }).notNull(),
    /** 下载文件 URL(可选,详情页点击时传) */
    assetHref: text('asset_href'),
    /** 点击来源:sidebar / detail_page */
    source: varchar('source', { length: 16 }).notNull(),
    /** 客户端 IP(IPv4/IPv6) */
    ip: varchar('ip', { length: 45 }),
    /** User-Agent */
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    platformIdx: index('download_events_platform_idx').on(table.platform),
    createdIdx: index('download_events_created_at_idx').on(table.createdAt),
    userIdIdx: index('download_events_user_id_idx').on(table.userId),
  }),
)

export type DownloadEvent = typeof downloadEvents.$inferSelect
export type NewDownloadEvent = typeof downloadEvents.$inferInsert
