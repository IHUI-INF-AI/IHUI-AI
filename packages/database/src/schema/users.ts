import { pgTable, uuid, varchar, integer, timestamp, text, date, boolean, unique } from 'drizzle-orm/pg-core'

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: varchar('phone', { length: 20 }).unique(),
    email: varchar('email', { length: 255 }).unique(),
    username: varchar('username', { length: 64 }).unique(),
    passwordHash: text('password_hash'),
    nickname: varchar('nickname', { length: 64 }),
    avatar: text('avatar'),
    bio: text('bio'),
    gender: integer('gender').default(0).notNull(), // 0=未知 1=男 2=女
    birthday: date('birthday'),
    familyId: uuid('family_id'),
    roleId: integer('role_id').default(0),
    status: integer('status').default(1).notNull(), // 0=禁用 1=正常 3=注销
    isVip: integer('is_vip').default(0).notNull(), // -1=游客 0=普通 1=VIP 2=操盘手
    level: integer('level').default(0).notNull(), // 0=普通 1=白银 2=黄金 3=钻石
    isSystemAdmin: boolean('is_system_admin').default(false).notNull(), // 系统内置管理员(DB 触发器+应用层双重锁,禁止任何 UPDATE/DELETE)
    inviteCode: varchar('invite_code', { length: 32 }),
    parentId: uuid('parent_id'), // 推荐人(分销关系链),不自引用 FK 以避免循环
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    inviteCodeIdx: unique('users_invite_code_unique').on(t.inviteCode),
  }),
)

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  token: text('token').unique(),
  familyId: uuid('family_id'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type RefreshToken = typeof refreshTokens.$inferSelect
export type NewRefreshToken = typeof refreshTokens.$inferInsert
