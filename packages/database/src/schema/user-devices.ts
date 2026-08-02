import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 用户设备表 (user_devices) — 按设备指纹识别真实设备(2026-08-02 立)。
 *
 * 替代 api_logs 聚合 IP+UA 的旧方案:换 IP/UA 即被视为新设备无法识别同设备换浏览器。
 * 本表以 fingerprintHash(客户端通过 x-device-fingerprint header 上报的指纹哈希)为唯一标识,
 * 同一用户同一设备只保留一条记录,登录成功时 upsert 更新 lastSeenAt/userAgent/ip。
 *
 * - fingerprintHash: 设备指纹哈希(32 字符,varchar(64) 留余量)
 * - trusted: 用户标记为信任设备(免二次验证等)
 * - lastLocation: 最后一次登录的地理位置(如 "Beijing, China")
 * - (userId, fingerprintHash) 唯一约束:upsert 的 conflict target
 */
export const userDevices = pgTable(
  'user_devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fingerprintHash: varchar('fingerprint_hash', { length: 64 }).notNull(),
    userAgent: text('user_agent'),
    ip: varchar('ip', { length: 45 }).notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    trusted: boolean('trusted').default(false).notNull(),
    lastLocation: varchar('last_location', { length: 128 }),
  },
  (t) => ({
    userIdx: index('user_devices_user_id_idx').on(t.userId),
    fingerprintHashIdx: index('user_devices_fingerprint_hash_idx').on(t.fingerprintHash),
    userFingerprintUnique: unique('user_devices_user_id_fingerprint_hash_unique').on(
      t.userId,
      t.fingerprintHash,
    ),
  }),
)

export type UserDevice = typeof userDevices.$inferSelect
export type NewUserDevice = typeof userDevices.$inferInsert
