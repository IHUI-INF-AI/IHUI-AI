import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 崩溃上报表(2026-08-06 立,打通崩溃率链路)。
 *
 * 背景:mobile-dashboard 的 crashRate 此前恒返回 null(项目无崩溃上报表),
 * 本次新增本表 + POST /api/crash-reports 上报端点 + 各端全局错误捕获埋点,
 * 一旦客户端出现崩溃即自动写入,admin 聚合出真实崩溃率。
 *
 * 设计:
 * - 匿名可上报(userId 为空 = 未登录用户),登录用户尽量携带 userId 便于归因
 * - 同一崩溃事件前端去重(componentDidCatch 只报一次),后端仅做字段校验 + 轻量限流
 * - platform 枚举与下载端一致:web/ios/android/desktop/extension/miniapp/mobile
 */
export const crashReports = pgTable(
  'crash_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    platform: varchar('platform', { length: 24 }).notNull(),
    version: varchar('version', { length: 64 }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    errorMessage: text('error_message').notNull(),
    stack: text('stack'),
    route: varchar('route', { length: 512 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    createdAtIdx: index('crash_reports_created_at_idx').on(t.createdAt),
    platformIdx: index('crash_reports_platform_idx').on(t.platform),
  }),
);

export type CrashReport = typeof crashReports.$inferSelect;
export type NewCrashReport = typeof crashReports.$inferInsert;
