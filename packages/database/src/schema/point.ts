import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 教育积分渠道表 - edu_platform 特有,区别于 gamification.ts 通用积分。
 */
export const eduPointChannels = pgTable('edu_point_channels', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }),
  description: text('description'),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(), // 1=启用 0=禁用
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 教育积分规则表 - 定义各行为积分值。
 */
export const eduPoints = pgTable(
  'edu_points',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    code: varchar('code', { length: 50 }),
    channelId: uuid('channel_id').references(() => eduPointChannels.id, { onDelete: 'set null' }),
    point: integer('point').default(0).notNull(),
    description: text('description'),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    chanIdx: index('edu_points_channel_idx').on(t.channelId),
  }),
);

/**
 * 积分渠道关联表 - 规则与渠道多对多。
 */
export const eduPointChannelRelations = pgTable(
  'edu_point_channel_relations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pointId: uuid('point_id')
      .notNull()
      .references(() => eduPoints.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => eduPointChannels.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: unique('edu_point_channel_relation_unique').on(t.pointId, t.channelId),
    pointIdx: index('edu_point_channel_relations_point_idx').on(t.pointId),
    chanIdx: index('edu_point_channel_relations_channel_idx').on(t.channelId),
  }),
);

/**
 * 教育积分记录表 - 用户积分变动流水。
 * type: 操作类型(如 earn/spend);refId 关联业务对象。
 */
export const eduPointRecords = pgTable(
  'edu_point_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    memberId: uuid('member_id').references(() => users.id, { onDelete: 'set null' }),
    point: integer('point').notNull(),
    balance: integer('balance').notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    description: varchar('description', { length: 255 }),
    refId: varchar('ref_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('edu_point_records_member_idx').on(t.memberId),
  }),
);

export type EduPointChannel = typeof eduPointChannels.$inferSelect;
export type NewEduPointChannel = typeof eduPointChannels.$inferInsert;
export type EduPoint = typeof eduPoints.$inferSelect;
export type NewEduPoint = typeof eduPoints.$inferInsert;
export type EduPointChannelRelation = typeof eduPointChannelRelations.$inferSelect;
export type NewEduPointChannelRelation = typeof eduPointChannelRelations.$inferInsert;
export type EduPointRecord = typeof eduPointRecords.$inferSelect;
export type NewEduPointRecord = typeof eduPointRecords.$inferInsert;
