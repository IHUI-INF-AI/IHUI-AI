import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 插件市场事件流表 (plugin_events) — 2026-07-22 新增。
 *
 * 用途:管理端监测插件热度 / 安装量 / 点击量 / 卸载量。
 * 写入时机:
 *  - click:  用户点击市场卡片外链 (POST /api/plugins/:id/click, 游客可触发)
 *  - install:  用户启用插件 (POST /api/plugins/:id/install)
 *  - uninstall: 用户卸载插件 (DELETE /api/plugins/:id/install)
 *  - pin:    用户置顶插件 (PATCH /api/plugins/:id/preferences pinned=true)
 *  - unpin:  用户取消置顶 (PATCH /api/plugins/:id/preferences pinned=false)
 *
 * 设计:
 *  - 仅追加 (append-only), 不修改不删除, 便于审计与趋势分析
 *  - userId 可空 (游客点击也计数)
 *  - pluginId 与 plugins-data.ts 中的 id 对应 (非外键, 因为插件元数据在代码常量中)
 *  - 热度公式: heat = install_count * 10 + click_count * 1 + pinned_count * 20
 */
export const pluginEventType = pgEnum('plugin_event_type', [
  'click',
  'install',
  'uninstall',
  'pin',
  'unpin',
])

export const pluginEvents = pgTable(
  'plugin_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pluginId: varchar('plugin_id', { length: 100 }).notNull(),
    eventType: pluginEventType('event_type').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    ip: varchar('ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pluginTypeDateIdx: index('plugin_events_plugin_type_date_idx').on(
      t.pluginId,
      t.eventType,
      t.createdAt,
    ),
    typeDateIdx: index('plugin_events_type_date_idx').on(t.eventType, t.createdAt),
    dateIdx: index('plugin_events_date_idx').on(t.createdAt),
  }),
)

export type PluginEvent = typeof pluginEvents.$inferSelect
export type NewPluginEvent = typeof pluginEvents.$inferInsert
