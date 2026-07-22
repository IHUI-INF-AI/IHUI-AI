import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  date,
  boolean,
  unique,
  jsonb,
  customType,
} from 'drizzle-orm/pg-core'
import { sysDepts } from './admin-sys.js'

/**
 * PostgreSQL bytea 类型 Drizzle 适配(drizzle-orm 0.38 原生 bytea 未稳定导出)。
 *
 * - dataType()   → 'bytea'
 * - toDriver()    → 写入时 Buffer 透传给 postgres-js (Buffer 是 PG bytea 的原生映射)
 * - fromDriver()  → 读取时把 Buffer 透传回应用层
 *
 * 用途:users.two_factor_secret 字段(AES-256-GCM 加密后的密文 Buffer)。
 */
export const bytea = customType<{
  data: Buffer | null
  driverData: Buffer | null
}>({
  dataType() {
    return 'bytea'
  },
  toDriver(value: Buffer | null): Buffer | null {
    return value
  },
  fromDriver(value: Buffer | null): Buffer | null {
    return value
  },
})

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
    deptId: integer('dept_id').references(() => sysDepts.deptId, { onDelete: 'set null' }),
    status: integer('status').default(1).notNull(), // 0=禁用 1=正常 3=注销
    isVip: integer('is_vip').default(0).notNull(), // -1=游客 0=普通 1=VIP 2=操盘手
    level: integer('level').default(0).notNull(), // 0=普通 1=白银 2=黄金 3=钻石
    isSystemAdmin: boolean('is_system_admin').default(false).notNull(), // 系统内置管理员(DB 触发器+应用层双重锁,禁止任何 UPDATE/DELETE)
    inviteCode: varchar('invite_code', { length: 32 }),
    parentId: uuid('parent_id'), // 推荐人(分销关系链),不自引用 FK 以避免循环
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    // 2FA/MFA (Wave 10, 2026-07-22):TOTP (RFC 6238) 双因素认证
    // - twoFactorSecret: AES-256-GCM 加密后的 EncryptedPayload Buffer (key=CREDENTIALS_ENCRYPTION_KEY)
    // - twoFactorEnabled: 启用后登录需 2FA challenge
    // - twoFactorBackupCodes: sha256 hash 数组,明文不存,单次使用后立即移除
    // - twoFactorEnabledAt: 启用时间,风控/审计用
    twoFactorSecret: bytea('two_factor_secret'),
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    twoFactorBackupCodes: jsonb('two_factor_backup_codes')
      .$type<string[]>()
      .notNull()
      .default([]),
    twoFactorEnabledAt: timestamp('two_factor_enabled_at', { withTimezone: true }),
  },
  (t) => ({
    inviteCodeIdx: unique('users_invite_code_unique').on(t.inviteCode),
  }),
)

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  // 2026-07-22 P1 鲁棒性加固:onDelete cascade 对齐 migration 0073(此前 schema 源码与 DB 三态不一致)
  // 用户被删除时其 refresh tokens 级联清理,防孤儿 token + 安全风险
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
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
