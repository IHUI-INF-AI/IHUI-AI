/**
 * D 盘社交行为表补迁移 schema（supplement）。
 * 迁移自 D:\历史项目存档\code\edu\service\service\init_database.sql
 *
 * 7 张表清单：
 *   1. circle_dynamic          → 已迁移至 relation-tables.ts（circleDynamic）
 *   2. t_dynamic               → 本文件新增
 *   3. t_favorite              → 本文件新增（与现代版 user_favorites 字段不同）
 *   4. t_follow                → 本文件新增（与现代版 user_follows 字段不同）
 *   5. t_like                  → 本文件新增
 *   6. t_private_letter        → 本文件新增
 *   7. t_content               → 本文件新增
 *
 * 上述 1 张已迁移表与 D 盘字段一致（serial 主键 vs D 盘 bigint，语义等价），
 * 不在本文件重复定义以避免 TypeScript export 冲突。
 */
import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// 通用动态
// ---------------------------------------------------------------------------

/**
 * 通用动态表（D 盘: t_dynamic）
 * 字段与 circle_dynamic 一致，作为通用动态备份/旧版。
 */
export const tDynamic = pgTable(
  't_dynamic',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    content: text('content').notNull(),
    memberId: bigint('member_id', { mode: 'number' }).notNull(),
    image: varchar('image', { length: 3000 }).default(''),
    status: varchar('status', { length: 100 }).notNull(),
    circleId: bigint('circle_id', { mode: 'number' }).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    circleIdx: index('t_dynamic_circle_idx').on(t.circleId),
    memberIdx: index('t_dynamic_member_idx').on(t.memberId),
  }),
)

// ---------------------------------------------------------------------------
// 收藏 / 关注 / 点赞
// ---------------------------------------------------------------------------

/**
 * 收藏表（D 盘: t_favorite）
 * 用户对各类资源（课程/知识评论等）的收藏记录。
 */
export const tFavorite = pgTable(
  't_favorite',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    topicId: bigint('topic_id', { mode: 'number' }).notNull(), // D 盘: topic_id bigint
    topicType: varchar('topic_type', { length: 50 }).notNull(), // D 盘: topic_type varchar(50)
    memberId: bigint('member_id', { mode: 'number' }).notNull(), // D 盘: member_id bigint
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    topicIdx: index('t_favorite_topic_idx').on(t.topicId, t.topicType),
    memberIdx: index('t_favorite_member_idx').on(t.memberId),
  }),
)

/**
 * 关注表（D 盘: t_follow）
 * 会员之间的关注关系。
 * status: 'follow' | 'unfollow' 等状态字符串。
 */
export const tFollow = pgTable(
  't_follow',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    memberId: bigint('member_id', { mode: 'number' }).notNull(), // D 盘: member_id bigint
    followMemberId: bigint('follow_member_id', { mode: 'number' }).notNull(), // D 盘: follow_member_id bigint
    status: varchar('status', { length: 100 }).default('follow').notNull(), // D 盘: status varchar(100) DEFAULT 'follow'
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    memberIdx: index('t_follow_member_idx').on(t.memberId),
    followMemberIdx: index('t_follow_follow_member_idx').on(t.followMemberId),
  }),
)

/**
 * 点赞表（D 盘: t_like）
 * 用户对各类主题的点赞记录。
 * status: 0=取消赞, 1=有效赞。
 */
export const tLike = pgTable(
  't_like',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    topicId: bigint('topic_id', { mode: 'number' }).notNull(),
    topicType: varchar('topic_type', { length: 50 }).notNull(),
    memberId: bigint('member_id', { mode: 'number' }).notNull(),
    status: boolean('status').default(true).notNull(), // D 盘: status tinyint DEFAULT 1
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    topicIdx: index('t_like_topic_idx').on(t.topicId, t.topicType),
    memberIdx: index('t_like_member_idx').on(t.memberId),
  }),
)

// ---------------------------------------------------------------------------
// 私信
// ---------------------------------------------------------------------------

/**
 * 私信表（D 盘: t_private_letter）
 * 用户之间的私信记录。
 * isRead: 0=未读, 1=已读。
 */
export const tPrivateLetter = pgTable(
  't_private_letter',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    senderId: varchar('sender_id', { length: 100 }).notNull(), // D 盘: sender_id varchar(100)
    receiverId: varchar('receiver_id', { length: 100 }).notNull(), // D 盘: receiver_id varchar(100)
    content: text('content').notNull(), // D 盘: content text
    readTime: timestamp('read_time', { withTimezone: true }), // D 盘: read_time timestamp NULL
    isRead: boolean('is_read').default(false).notNull(), // D 盘: is_read tinyint DEFAULT 0
    status: varchar('status', { length: 30 }).notNull(), // D 盘: status varchar(30)
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    senderIdx: index('t_private_letter_sender_idx').on(t.senderId),
    receiverIdx: index('t_private_letter_receiver_idx').on(t.receiverId),
  }),
)

// ---------------------------------------------------------------------------
// 内容索引
// ---------------------------------------------------------------------------

/**
 * 可搜索内容表（D 盘: t_content）
 * 与 search_content 类似但字段更简，记录可被检索的主题元信息。
 */
export const tContent = pgTable(
  't_content',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    topicId: bigint('topic_id', { mode: 'number' }).notNull(), // D 盘: topic_id bigint
    topicTitle: varchar('topic_title', { length: 2000 }).notNull(), // D 盘: topic_title varchar(2000)
    topicType: varchar('topic_type', { length: 50 }).notNull(), // D 盘: topic_type varchar(50)
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    topicIdx: index('t_content_topic_idx').on(t.topicId, t.topicType),
    typeIdx: index('t_content_type_idx').on(t.topicType),
  }),
)

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type TDynamic = typeof tDynamic.$inferSelect
export type NewTDynamic = typeof tDynamic.$inferInsert
export type TFavorite = typeof tFavorite.$inferSelect
export type NewTFavorite = typeof tFavorite.$inferInsert
export type TFollow = typeof tFollow.$inferSelect
export type NewTFollow = typeof tFollow.$inferInsert
export type TLike = typeof tLike.$inferSelect
export type NewTLike = typeof tLike.$inferInsert
export type TPrivateLetter = typeof tPrivateLetter.$inferSelect
export type NewTPrivateLetter = typeof tPrivateLetter.$inferInsert
export type TContent = typeof tContent.$inferSelect
export type NewTContent = typeof tContent.$inferInsert
