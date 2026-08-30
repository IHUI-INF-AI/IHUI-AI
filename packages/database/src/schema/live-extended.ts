/**
 * 直播互动扩展 schema（等价自旧架构 live_models / live_ext_models）。
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
  uuid,
  index,
  unique,
  numeric,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// 直播分类关系
// ---------------------------------------------------------------------------

/** 直播分类关系表（树形结构父子关系） */

/** 直播频道分类表 */

/** 频道分类关系表（频道与分类多对多） */

// ---------------------------------------------------------------------------
// 频道讲师
// ---------------------------------------------------------------------------

/** 频道讲师关联表（频道与讲师多对多） */

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

// ---------------------------------------------------------------------------
// 直播订阅
// ---------------------------------------------------------------------------

/** 直播订阅表 */
export const liveSubscribe = pgTable(
  'live_subscribe',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    channelId: uuid('channel_id').notNull(),
    isNotify: boolean('is_notify').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: unique('live_subscribe_user_channel_uniq').on(t.userId, t.channelId),
    userIdx: index('live_subscribe_user_idx').on(t.userId),
    chanIdx: index('live_subscribe_channel_idx').on(t.channelId),
  }),
)

// ---------------------------------------------------------------------------
// 腾讯云直播流
// ---------------------------------------------------------------------------

/** 腾讯云直播流信息表 */

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type LiveComment = typeof liveComment.$inferSelect
export type NewLiveComment = typeof liveComment.$inferInsert
export type LiveSubscribe = typeof liveSubscribe.$inferSelect
export type NewLiveSubscribe = typeof liveSubscribe.$inferInsert

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

export type LiveGift = typeof liveGift.$inferSelect
export type NewLiveGift = typeof liveGift.$inferInsert

/** 直播礼物目录（2026-08-31 立，原内联于 live-gifts.ts，纳入共享 schema 单一来源）。 */
export const liveGiftCatalog = pgTable('live_gift_catalog', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 500 }),
  price: numeric('price', { precision: 20, scale: 4 }).default('0').notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
