/**
 * 直播互动扩展 schema（迁移自旧架构 live_models / live_ext_models）。
 * 涵盖：分类关系 / 频道分类 / 频道讲师 / 评论弹幕 / 礼物 / 订阅 / 腾讯云直播流。
 */
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// 直播分类关系
// ---------------------------------------------------------------------------

/** 直播分类关系表（树形结构父子关系） */
export const liveCategoryRelation = pgTable('live_category_relation', {
  id: serial('id').primaryKey(),
  childCategoryId: integer('child_category_id').notNull(),
  fatherCategoryId: integer('father_category_id').notNull(),
  directFatherCategoryId: integer('direct_father_category_id').notNull(),
  isSub: boolean('is_sub').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 直播频道分类表 */
export const liveChannelCategory = pgTable('live_channel_category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isShow: boolean('is_show').default(true).notNull(),
  icon: varchar('icon', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 频道分类关系表（频道与分类多对多） */
export const liveChannelCategoryRelation = pgTable(
  'live_channel_category_relation',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id').notNull(),
    channelId: integer('channel_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('live_channel_category_relation_cat_idx').on(t.categoryId),
    chanIdx: index('live_channel_category_relation_chan_idx').on(t.channelId),
  }),
)

// ---------------------------------------------------------------------------
// 频道讲师
// ---------------------------------------------------------------------------

/** 频道讲师关联表（频道与讲师多对多） */
export const liveChannelLecturer = pgTable(
  'live_channel_lecturer',
  {
    id: serial('id').primaryKey(),
    lecturerId: integer('lecturer_id').notNull(),
    channelId: integer('channel_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    lectIdx: index('live_channel_lecturer_lecturer_idx').on(t.lecturerId),
    chanIdx: index('live_channel_lecturer_channel_idx').on(t.channelId),
  }),
)

// ---------------------------------------------------------------------------
// 直播评论 / 弹幕
// ---------------------------------------------------------------------------

/** 直播评论/弹幕表 */
export const liveComment = pgTable(
  'live_comment',
  {
    id: serial('id').primaryKey(),
    channelId: integer('channel_id').notNull(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    userName: varchar('user_name', { length: 100 }),
    userAvatar: varchar('user_avatar', { length: 500 }),
    content: text('content').notNull(),
    type: integer('type').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    chanIdx: index('live_comment_channel_idx').on(t.channelId),
    userIdx: index('live_comment_user_idx').on(t.userId),
  }),
)

// ---------------------------------------------------------------------------
// 直播礼物
// ---------------------------------------------------------------------------

/** 直播礼物记录表 */
export const liveGift = pgTable(
  'live_gift',
  {
    id: serial('id').primaryKey(),
    channelId: integer('channel_id').notNull(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    userName: varchar('user_name', { length: 100 }),
    giftId: integer('gift_id'),
    giftName: varchar('gift_name', { length: 100 }),
    giftCount: integer('gift_count').default(1).notNull(),
    totalPrice: integer('total_price').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    chanIdx: index('live_gift_channel_idx').on(t.channelId),
    userIdx: index('live_gift_user_idx').on(t.userId),
  }),
)

// ---------------------------------------------------------------------------
// 直播订阅
// ---------------------------------------------------------------------------

/** 直播订阅表 */
export const liveSubscribe = pgTable(
  'live_subscribe',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    channelId: integer('channel_id').notNull(),
    isNotify: boolean('is_notify').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('live_subscribe_user_idx').on(t.userId),
    chanIdx: index('live_subscribe_channel_idx').on(t.channelId),
  }),
)

// ---------------------------------------------------------------------------
// 腾讯云直播流
// ---------------------------------------------------------------------------

/** 腾讯云直播流信息表 */
export const liveTencentCloudLiveStream = pgTable(
  'live_tencent_cloud_live_stream',
  {
    id: serial('id').primaryKey(),
    channelId: integer('channel_id').notNull(),
    streamName: varchar('stream_name', { length: 200 }).notNull(),
    appName: varchar('app_name', { length: 200 }).default('live').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ chanIdx: index('live_tencent_cloud_live_stream_chan_idx').on(t.channelId) }),
)

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type LiveCategoryRelation = typeof liveCategoryRelation.$inferSelect
export type NewLiveCategoryRelation = typeof liveCategoryRelation.$inferInsert
export type LiveChannelCategory = typeof liveChannelCategory.$inferSelect
export type NewLiveChannelCategory = typeof liveChannelCategory.$inferInsert
export type LiveChannelCategoryRelation = typeof liveChannelCategoryRelation.$inferSelect
export type NewLiveChannelCategoryRelation = typeof liveChannelCategoryRelation.$inferInsert
export type LiveChannelLecturer = typeof liveChannelLecturer.$inferSelect
export type NewLiveChannelLecturer = typeof liveChannelLecturer.$inferInsert
export type LiveComment = typeof liveComment.$inferSelect
export type NewLiveComment = typeof liveComment.$inferInsert
export type LiveGift = typeof liveGift.$inferSelect
export type NewLiveGift = typeof liveGift.$inferInsert
export type LiveSubscribe = typeof liveSubscribe.$inferSelect
export type NewLiveSubscribe = typeof liveSubscribe.$inferInsert
export type LiveTencentCloudLiveStream = typeof liveTencentCloudLiveStream.$inferSelect
export type NewLiveTencentCloudLiveStream = typeof liveTencentCloudLiveStream.$inferInsert
