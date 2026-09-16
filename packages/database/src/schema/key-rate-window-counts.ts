// __PROVENANCE_HEAD_1__
// __PROVENANCE_HEAD_2__
// __PROVENANCE_HEAD_3__

import { pgTable, uuid, varchar, bigint, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { developerApiKeys } from './developer-api-keys.js'

/**
 * Key 级限流窗口计数表(key_rate_window_counts,2026-09-16 立,补强 B)。
 *
 * 每个 Key × 窗口类型(5h/1d/7d) × 窗口起点 一行,记录该窗口内请求数。
 * 唯一索引 (key_id, window_type, window_start) 保证并发下单行,
 * 写入用 UPSERT 累加(见 key-rate-window-service)。
 * 窗口起点口径:5h = epoch 固定对齐;1d/7d = UTC+8。
 */
export const keyRateWindowCounts = pgTable(
  'key_rate_window_counts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    keyId: uuid('key_id')
      .references(() => developerApiKeys.id, { onDelete: 'cascade' })
      .notNull(),
    /** 窗口类型:5h | 1d | 7d */
    windowType: varchar('window_type', { length: 8 }).notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    requestCount: bigint('request_count', { mode: 'number' }).default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    windowUniqIdx: uniqueIndex('key_rate_window_counts_uniq_idx').on(
      t.keyId,
      t.windowType,
      t.windowStart,
    ),
    keyWindowIdx: index('key_rate_window_counts_key_idx').on(t.keyId, t.windowType),
  }),
)

export type KeyRateWindowCount = typeof keyRateWindowCounts.$inferSelect
export type NewKeyRateWindowCount = typeof keyRateWindowCounts.$inferInsert
// __PROVENANCE_TAIL__
