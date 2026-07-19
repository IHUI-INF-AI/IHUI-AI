/**
 * D 盘直播表补迁移 schema（supplement）。
 * 迁移自 D:\历史项目存档\code\edu\service\service\init_database.sql
 *
 * 4 张表清单：
 *   1. live_channel_lecturer          → 已迁移至 live-extended.ts（liveChannelLecturer）
 *   2. live_subscribe                 → 已迁移至 live-extended.ts（liveSubscribe）
 *   3. live_tencent_cloud_live_stream → 已迁移至 live-extended.ts（liveTencentCloudLiveStream）
 *   4. t_tencent_cloud_live_stream    → 本文件新增（legacy 备份/旧版）
 *
 * 上述 3 张已迁移表与 D 盘字段完全等价（仅 create_time→created_at 命名规范化），
 * 不在本文件重复定义以避免 PostgreSQL 表名冲突。
 */
import { pgTable, bigserial, bigint, varchar, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 腾讯云直播流信息表（D 盘 legacy: t_tencent_cloud_live_stream）
 * 与 live-extended.ts 中 liveTencentCloudLiveStream 字段一致，作为旧版备份。
 */
export const tTencentCloudLiveStream = pgTable(
  't_tencent_cloud_live_stream',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(), // D 盘: id bigint AUTO_INCREMENT
    channelId: bigint('channel_id', { mode: 'number' }).notNull(), // D 盘: channel_id bigint
    streamName: varchar('stream_name', { length: 200 }).notNull(), // D 盘: stream_name varchar(200)
    appName: varchar('app_name', { length: 200 }).default('live').notNull(), // D 盘: app_name varchar(200) DEFAULT 'live'
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow().notNull(), // D 盘: create_time NOT NULL
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow().notNull(), // D 盘: update_time NOT NULL
  },
  (t) => ({
    chanIdx: index('t_tencent_cloud_live_stream_chan_idx').on(t.channelId),
  }),
)

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type TTencentCloudLiveStream = typeof tTencentCloudLiveStream.$inferSelect
export type NewTTencentCloudLiveStream = typeof tTencentCloudLiveStream.$inferInsert
