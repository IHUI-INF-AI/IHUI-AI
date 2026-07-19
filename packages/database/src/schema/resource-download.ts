/**
 * D 盘资源下载/搜索表补迁移 schema（supplement）。
 * 迁移自 D:\历史项目存档\code\edu\service\service\init_database.sql
 *
 * 4 张表清单：
 *   1. resource_resource_download       → 已迁移至 relation-tables.ts（resourceResourceDownload）
 *   2. resource_resource_search_record  → 已迁移至 relation-tables.ts（resourceResourceSearchRecord）
 *   3. t_resource_download              → 本文件新增（legacy 备份/旧版，与 resource_resource_download 字段一致）
 *   4. search_content                   → 本文件新增（与现代版 search_contents 表名不冲突）
 *
 * 上述 2 张已迁移表与 D 盘字段一致（serial 主键 vs D 盘 bigint，语义等价），
 * 不在本文件重复定义以避免 TypeScript export 冲突。
 */
import { pgTable, bigserial, bigint, varchar, timestamp, index } from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// 资源下载记录
// ---------------------------------------------------------------------------

/**
 * 会员下载记录表（D 盘 legacy: t_resource_download）
 * 与 resource_resource_download 字段一致，作为旧版备份。
 */
export const tResourceDownload = pgTable(
  't_resource_download',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    memberId: bigint('member_id', { mode: 'number' }).notNull(), // D 盘: member_id bigint
    resourceId: bigint('resource_id', { mode: 'number' }).notNull(), // D 盘: resource_id bigint
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    memberIdx: index('t_resource_download_member_idx').on(t.memberId),
    resourceIdx: index('t_resource_download_resource_idx').on(t.resourceId),
  }),
)

// ---------------------------------------------------------------------------
// 可搜索内容索引
// ---------------------------------------------------------------------------

/**
 * 可搜索内容索引表（D 盘: search_content）
 * 与 search-contents.ts 中 search_contents（UUID 现代版）字段语义类似但主键类型不同。
 * D 盘版 bigint 自增；现代版 UUID。表名 search_content（单数）与现代版 search_contents（复数）不冲突。
 */
export const searchContent = pgTable(
  'search_content',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    topicId: bigint('topic_id', { mode: 'number' }).notNull(), // D 盘: topic_id bigint
    topicTitle: varchar('topic_title', { length: 2000 }).notNull(), // D 盘: topic_title varchar(2000)
    topicType: varchar('topic_type', { length: 50 }).notNull(), // D 盘: topic_type varchar(50)
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    topicIdx: index('search_content_topic_idx').on(t.topicId, t.topicType),
    typeIdx: index('search_content_type_idx').on(t.topicType),
  }),
)

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type TResourceDownload = typeof tResourceDownload.$inferSelect
export type NewTResourceDownload = typeof tResourceDownload.$inferInsert
// 重命名为 LegacySearchContent 以避免与 search-contents.ts 中 SearchContent 类型冲突
export type LegacySearchContent = typeof searchContent.$inferSelect
export type NewLegacySearchContent = typeof searchContent.$inferInsert
