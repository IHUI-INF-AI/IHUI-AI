import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

/**
 * 插件元数据表 (plugins) — 2026-08-04 新增,§24 用户已确认 DB 化。
 *
 * 原 plugins-data.ts 代码常量迁移到 DB,支持后台 CRUD(上架/下架/编辑)。
 * agent-creation.ts type='plugin' 分支查询此表。
 * plugin_events 表的 pluginId 软引用此表 name(非外键,兼容历史数据)。
 *
 * 设计:插件是平台级的(无 userId 字段),全局共享;通过 is_active 控制上下架。
 */
export const plugins = pgTable(
  'plugins',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 插件技术名(唯一,kebab-case,如 'code-reviewer') */
    name: varchar('name', { length: 128 }).notNull().unique(),
    /** 显示名 */
    displayName: varchar('display_name', { length: 256 }).notNull(),
    description: text('description'),
    /** 版本号 semver */
    version: varchar('version', { length: 32 }).default('1.0.0').notNull(),
    /** 作者 */
    author: varchar('author', { length: 128 }),
    /** 分类,如 'ai'/'tool'/'integration' */
    category: varchar('category', { length: 64 }),
    /** 图标 URL */
    icon: varchar('icon', { length: 512 }),
    /** README 文档 markdown */
    readme: text('readme'),
    /** 是否官方插件 */
    isOfficial: boolean('is_official').default(false).notNull(),
    /** 是否上架(下架的不在列表显示) */
    isActive: boolean('is_active').default(true).notNull(),
    /** 下载 URL */
    downloadUrl: varchar('download_url', { length: 512 }),
    /** 配置 schema JSON */
    config: jsonb('config'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index('idx_plugins_category').on(t.category),
    activeIdx: index('idx_plugins_active').on(t.isActive),
  }),
)

export type Plugin = typeof plugins.$inferSelect
export type NewPlugin = typeof plugins.$inferInsert
