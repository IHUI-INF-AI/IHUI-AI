import { pgTable, uuid, varchar, integer, timestamp, text, boolean, jsonb, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 邀请码表。
 * code: 8 位大写字母+数字（排除 O/0/I/1）。
 * status: 'unused' | 'used' | 'expired'。
 * inviter_id 级联删除；invitee_id 可空（被邀请人注册时填入）。
 * reward_inviter / reward_invitee 为奖励积分。
 */
export const invitationCodes = pgTable('invitation_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 16 }).notNull().unique(),
  inviterId: uuid('inviter_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  inviteeId: uuid('invitee_id').references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 16 }).default('unused').notNull(),
  rewardInviter: integer('reward_inviter').default(0).notNull(),
  rewardInvitee: integer('reward_invitee').default(0).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 活动表。
 * slug: 唯一标识，用于公开查询。
 * status: 'draft' | 'published' | 'ended'。
 * rules: 活动规则（jsonb，结构由业务定义）。
 */
export const activities = pgTable('activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 128 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  description: text('description'),
  banner: varchar('banner', { length: 512 }),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 16 }).default('draft').notNull(),
  rules: jsonb('rules').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 活动参与表。
 * (activity_id, user_id) 联合唯一：同一用户在同一活动仅一条记录。
 */
export const activityParticipants = pgTable(
  'activity_participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    activityId: uuid('activity_id')
      .references(() => activities.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    data: jsonb('data'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    activityUserUnique: unique().on(t.activityId, t.userId),
  }),
);

/**
 * 优惠券表。
 * type: 'fixed'（固定金额，单位分） | 'percent'（百分比 0-100）。
 * value: fixed=分 amount；percent=百分比。
 * min_amount: 满减门槛（分）；max_uses: null 表示无限。
 */
export const coupons = pgTable('coupons', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  type: varchar('type', { length: 16 }).notNull(),
  value: integer('value').notNull(),
  minAmount: integer('min_amount').default(0).notNull(),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').default(0).notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type InvitationCode = typeof invitationCodes.$inferSelect;
export type NewInvitationCode = typeof invitationCodes.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type ActivityParticipant = typeof activityParticipants.$inferSelect;
export type NewActivityParticipant = typeof activityParticipants.$inferInsert;
export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
