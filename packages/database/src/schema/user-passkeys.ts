import {
  pgTable,
  serial,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * Passkey 无密码登录凭证表(2026-08-01 立,WebAuthn/FIDO2 凭证存储 + counter 防重放)。
 *
 * - credentialId: WebAuthn 凭证 ID(Base64URL 编码),唯一
 * - publicKey: 公钥(存储为 Base64/PEM,验证签名用)
 * - counter: 签名计数器(每次认证递增,防重放攻击)
 * - transports: 支持的传输方式(jsonb 数组: ['usb','ble','nfc','internal'])
 * - deviceType: 平台认证器(platform) / 跨平台认证器(cross-platform)
 * - backedUp: 是否已备份(云端同步的 passkey)
 * - name: 用户自定义名称(如 "MacBook Touch ID")
 *
 * 占位实现(2026-07-31):其他 agent 引用了本文件但未创建,此处补全表定义让 api 可启动。
 * 后续可按需扩展字段或新增 migration。
 */
export const userPasskeys = pgTable(
  'user_passkeys',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    credentialId: varchar('credential_id', { length: 255 }).notNull().unique(),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').default(0).notNull(),
    transports: varchar('transports', { length: 100 }),
    deviceType: varchar('device_type', { length: 20 }),
    backedUp: boolean('backed_up').default(false).notNull(),
    name: varchar('name', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('user_passkeys_user_id_idx').on(t.userId),
  }),
)
