import { pgTable, uuid, text, bigint, timestamp, index } from 'drizzle-orm/pg-core'
import { users, bytea } from './users.js'

/**
 * Passkey (WebAuthn/FIDO2) 无密码登录凭证表(2026-08-01 立)。
 *
 * 与 migration 20260801010020_add_user_passkeys_table.sql 严格对齐:
 * - id: uuid 主键(gen_random_uuid)
 * - credentialId: WebAuthn 凭证 ID(Base64URL 编码),全局唯一
 * - publicKey: 凭证公钥(bytea,验证认证响应签名)
 * - counter: 签名计数器(bigint,每次认证递增,防重放攻击,必须 > 上次值)
 * - transports: 支持的传输方式数组(usb/nfc/ble/internal/hybrid)
 * - deviceType: 设备类型(singleDevice | multiDevice,反映是否可漫游)
 * - aaguid: 认证器型号标识(AAGUID,识别硬件/软件 authenticator)
 * - name: 用户自定义名称(MacBook Pro / iPhone 等,便于管理多个 Passkey)
 *
 * bytea 类型复用 users.ts 的 customType(drizzle-orm 0.38 原生 bytea 未稳定导出)。
 */
export const userPasskeys = pgTable(
  'user_passkeys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    credentialId: text('credential_id').notNull().unique(),
    publicKey: bytea('public_key').notNull(),
    counter: bigint('counter', { mode: 'number' }).default(0).notNull(),
    transports: text('transports').array(),
    deviceType: text('device_type'),
    aaguid: text('aaguid'),
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('user_passkeys_user_id_idx').on(t.userId),
    credentialIdIdx: index('user_passkeys_credential_id_idx').on(t.credentialId),
  }),
)

export type UserPasskey = typeof userPasskeys.$inferSelect
export type NewUserPasskey = typeof userPasskeys.$inferInsert
