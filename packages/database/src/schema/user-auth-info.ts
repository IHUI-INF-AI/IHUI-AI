import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users.js'

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
  // 实名认证字段
  realName: varchar('real_name', { length: 50 }),
  idCard: varchar('id_card', { length: 20 }),
  authStatus: varchar('auth_status', { length: 32 }).default('unverified').notNull(), // unverified/pending/approved/rejected
  authSource: varchar('auth_source', { length: 50 }),
  authAt: timestamp('auth_at', { withTimezone: true }),
  rejectReason: varchar('reject_reason', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type UserAuthInfo = typeof userAuthInfo.$inferSelect
export type NewUserAuthInfo = typeof userAuthInfo.$inferInsert
