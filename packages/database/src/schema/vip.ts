import { pgTable, uuid, varchar, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { orders } from './billing.js';

/**
 * VIP 等级表。
 * price 以分为单位。durationDays: 有效天数。benefits: 权益列表（jsonb）。
 * status: 1=上架 0=下架
 */
export const vipLevels = pgTable(
  'vip_levels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    levelName: varchar('level_name', { length: 100 }).notNull(),
    levelValue: integer('level_value').default(0).notNull(), // 0=普通 1=VIP 2=操盘手
    price: integer('price').default(0).notNull(),
    durationDays: integer('duration_days').default(30).notNull(),
    benefits: jsonb('benefits').notNull().default([]),
    status: integer('status').default(1).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('vip_levels_status_idx').on(t.status),
  }),
);

/**
 * 用户 VIP 订阅记录表。
 * status: 0=过期 1=生效 2=已取消
 */
export const userVips = pgTable(
  'user_vips',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    vipLevelId: uuid('vip_level_id')
      .references(() => vipLevels.id, { onDelete: 'set null' }),
    levelValue: integer('level_value').default(0).notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    status: integer('status').default(1).notNull(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_vips_user_idx').on(t.userId),
    statusIdx: index('user_vips_status_idx').on(t.status),
  }),
);

export type VipLevel = typeof vipLevels.$inferSelect;
export type NewVipLevel = typeof vipLevels.$inferInsert;
export type UserVip = typeof userVips.$inferSelect;
export type NewUserVip = typeof userVips.$inferInsert;
