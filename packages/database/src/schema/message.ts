import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 教育平台公告表。
 * - isPublished: 是否发布。
 * - isTop: 是否置顶。
 * - publishTime: 发布时间（可为空，表示立即发布）。
 * - status: 1=启用 0=禁用。
 */
export const eduAnnouncements = pgTable(
  'edu_announcements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content'),
    isPublished: boolean('is_published').default(false).notNull(),
    isTop: boolean('is_top').default(false).notNull(),
    publishTime: timestamp('publish_time', { withTimezone: true }),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pubIdx: index('edu_announcements_published_idx').on(t.isPublished),
    statusIdx: index('edu_announcements_status_idx').on(t.status),
  }),
);

/**
 * 教育平台站内消息表（与通用 notifications/messages 区分）。
 * - memberId: 接收者（删除用户时级联）。
 * - senderId: 发送者，可空（系统消息）。
 * - msgType: 消息类型，如 system/order/lesson 等。
 * - refId/refType: 关联业务对象（如课程 id / lesson）。
 */
export const eduMessages = pgTable(
  'edu_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 200 }),
    content: text('content'),
    msgType: varchar('msg_type', { length: 32 }).default('system').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    refId: varchar('ref_id', { length: 64 }),
    refType: varchar('ref_type', { length: 32 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('edu_messages_member_idx').on(t.memberId),
    memberReadIdx: index('edu_messages_member_read_idx').on(t.memberId, t.isRead),
  }),
);

export type EduAnnouncement = typeof eduAnnouncements.$inferSelect;
export type NewEduAnnouncement = typeof eduAnnouncements.$inferInsert;
export type EduMessage = typeof eduMessages.$inferSelect;
export type NewEduMessage = typeof eduMessages.$inferInsert;
