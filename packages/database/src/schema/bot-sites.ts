import { pgTable, serial, varchar, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * AI 工具站点信息表（aibot_sites）。
 * 等价自 Java aibot_sites（ai-bot.cn 工具采集表）。
 * - section/sub_section: 一级/二级分类。
 * - panel_html: 站点详情面板 HTML。
 */
export const aibotSites = pgTable('aibot_sites', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  shortDesc: text('short_desc'),
  section: varchar('section', { length: 128 }),
  subSection: varchar('sub_section', { length: 255 }),
  iconUrl: varchar('icon_url', { length: 512 }),
  detailUrl: varchar('detail_url', { length: 512 }),
  officialUrl: varchar('official_url', { length: 512 }),
  panelHtml: text('panel_html'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 简化智能体配置表（simple_bot_configs）。
 * - shortcut_commands: 快捷指令数组（JSON）。
 * - agents_variable: 智能体变量数组（JSON）。
 * - other_config: 其它配置（JSON 对象）。
 */

export type AibotSite = typeof aibotSites.$inferSelect
export type NewAibotSite = typeof aibotSites.$inferInsert
