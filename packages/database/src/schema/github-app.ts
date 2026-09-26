// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { bigint, index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

/**
 * GitHub App 安装实例映射(D15①)。
 *
 * 数据来源:webhook `installation` 事件(created / deleted / new_permission_accepted),
 * installation_id 全局唯一(GitHub 侧主键),本表是"GitHub 安装 → 平台可见列表"的落库映射。
 *
 * status:'active'(已安装/权限更新) / 'removed'(已卸载)。
 * installed_by_user_id:GitHub 侧操作者(sender.id),**不是**平台用户 id,故不设外键;
 * webhook 无法把它映射到平台账号,通常只能拿到 GitHub 侧数字 id。
 */
export const githubAppInstallations = pgTable(
  'github_app_installations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    installationId: bigint('installation_id', { mode: 'number' }).notNull(),
    accountLogin: varchar('account_login', { length: 255 }),
    targetType: varchar('target_type', { length: 20 }),
    installedByUserId: bigint('installed_by_user_id', { mode: 'number' }),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    installationUx: uniqueIndex('ux_github_app_installations_installation').on(t.installationId),
    statusIdx: index('ix_github_app_installations_status').on(t.status),
  }),
)

/**
 * GitHub App webhook 投递幂等表(D15②)。
 *
 * 内存 LRU 是一级缓存(覆盖分钟级重投窗口),本表是持久层 —— API 重启后
 * 同一 X-GitHub-Delivery 的重投仍能在表里命中,不再重复处理。
 * 只有"已处理完成"的投递落表;status 目前恒为 'processed',预留 'failed' 供后续补偿扫描。
 */
export const githubAppDeliveries = pgTable(
  'github_app_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deliveryId: varchar('delivery_id', { length: 64 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    status: varchar('status', { length: 20 }).default('processed').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    deliveryUx: uniqueIndex('ux_github_app_deliveries_delivery').on(t.deliveryId),
    processedAtIdx: index('ix_github_app_deliveries_processed_at').on(t.processedAt),
  }),
)

export type GithubAppInstallation = typeof githubAppInstallations.$inferSelect
export type NewGithubAppInstallation = typeof githubAppInstallations.$inferInsert
export type GithubAppDelivery = typeof githubAppDeliveries.$inferSelect
export type NewGithubAppDelivery = typeof githubAppDeliveries.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
