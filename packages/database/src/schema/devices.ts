// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { pgTable, uuid, varchar, text, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { chatConversations } from './chat.js'

/**
 * G1 跨设备互联闭环(2026-10-30 立)。
 *
 * 与既有两张表互不混用:
 * - `device_tokens`(推送令牌,FCM/APNS/Web Push)与 `user_devices`(登录设备指纹)
 *   语义都不覆盖"可承接委托任务的工作端设备",故本文件新立三张表。
 * - capabilities 用 jsonb 自由形态(如 {"roles":["desktop","cli"],"workspaces":[...]}),
 *   避免为能力词表引入 pg enum 兼容性问题(同 notifications.type 的取舍)。
 */
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    os: varchar('os', { length: 128 }),
    capabilities: jsonb('capabilities'),
    // G1b 设备指纹(2026-10-31,对齐 Qoder 0.5.1 peerDeviceStateFingerprintMismatch 的
    // 安全语义):客户端自生成并持久存的一次性绑定凭据,注册(兑换)时写入;此后每个
    // 设备请求必须带同一指纹,不一致即 403 —— 防 token 被窃后在其他机器重放。
    // 与 user_devices 的登录指纹(anomaly-detector 输入面)语义不同:那边是登录行为
    // 分析的观察值,这边是执行体身份绑定的校验值,两套判据互不复用。
    fingerprint: varchar('fingerprint', { length: 128 }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // 撤销=置时间戳而非物理删除:任务历史仍要能回显设备名;null = 有效。
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    // 同用户同设备名重复注册 = 幂等更新 last_seen(onConflictDoUpdate 的 conflict target)。
    userNameUniq: unique('devices_user_name_unique').on(t.userId, t.name),
    userRevokedIdx: index('devices_user_revoked_idx').on(t.userId, t.revokedAt),
  }),
)

/**
 * 设备配对码表。
 * 只存 sha256 哈希(6 位数字码 + 服务端密钥),明文码仅在签发响应里出现一次。
 * 单次使用:used_at 原子置位;过期:expires_at(签发后 5 分钟)。
 */
export const devicePairCodes = pgTable(
  'device_pair_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    codeHash: varchar('code_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index('device_pair_codes_user_created_idx').on(t.userId, t.createdAt),
  }),
)

/**
 * 设备委托任务表。
 * status 封闭集:queued | claimed | running | completed | failed | expired(varchar,同词表纪律)。
 * queued 超 24h 未认领 → expired(claim 与列表查询时惰性判定,不建周期任务)。
 * session_id 指向 chat_conversations(会话转录所在表)。
 */
export const deviceTasks = pgTable(
  'device_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .references(() => chatConversations.id, { onDelete: 'cascade' })
      .notNull(),
    targetDeviceId: uuid('target_device_id')
      .references(() => devices.id, { onDelete: 'cascade' })
      .notNull(),
    status: varchar('status', { length: 16 }).default('queued').notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    error: text('error'),
    resultSummary: jsonb('result_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid('created_by')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => ({
    // claim 的热路径:按 (target_device_id, status) 过滤 + created_at 排序取最早 queued。
    deviceStatusCreatedIdx: index('device_tasks_device_status_created_idx').on(
      t.targetDeviceId,
      t.status,
      t.createdAt,
    ),
    sessionIdx: index('device_tasks_session_idx').on(t.sessionId),
  }),
)

export type Device = typeof devices.$inferSelect
export type NewDevice = typeof devices.$inferInsert
export type DevicePairCode = typeof devicePairCodes.$inferSelect
export type NewDevicePairCode = typeof devicePairCodes.$inferInsert
export type DeviceTask = typeof deviceTasks.$inferSelect
export type NewDeviceTask = typeof deviceTasks.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
