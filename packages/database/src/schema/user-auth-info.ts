import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 用户认证信息表 (历史 user_auth_info)。
 * 与 users 表 1:1 关系, userUuid 既是主键也是外键。
 * phone: 手机号。cancelPhone: 已注销的手机号。
 */
export const userAuthInfo = pgTable('user_auth_info', {
  userUuid: uuid('user_uuid')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  phone: varchar('phone', { length: 20 }),
  cancelPhone: varchar('cancel_phone', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type UserAuthInfo = typeof userAuthInfo.$inferSelect;
export type NewUserAuthInfo = typeof userAuthInfo.$inferInsert;
