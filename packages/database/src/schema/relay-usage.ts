// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { pgTable, uuid, date, integer, bigint, timestamp, index, unique } from 'drizzle-orm/pg-core'
import { aiRelayKeyPool } from './ai-relay.js'
import { developerApiKeys } from './developer-api-keys.js'

/**
 * 渠道按日用量统计 (ai_relay_channel_daily_usage)。
 *
 * 由 apps/api/src/services/channel-quota-service.ts 以 raw SQL 读写,
 * 此处补 TS schema 定义以消除 check-db-schema-drift 的 dead migration 告警
 * (与 ab-tests.ts 同一先例:保持 packages/database 单一数据源的表名一致性)。
 * migration: 20260801010050_add_channel_quota_fields.sql
 */
export const aiRelayChannelDailyUsage = pgTable(
  'ai_relay_channel_daily_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 关联 ai_relay_key_pool.id(级联删除) */
    keyPoolId: uuid('key_pool_id')
      .notNull()
      .references(() => aiRelayKeyPool.id, { onDelete: 'cascade' }),
    /** 统计日期(UTC date,按日聚合) */
    usageDate: date('usage_date').notNull().defaultNow(),
    /** 当日调用次数(含错误) */
    callCount: integer('call_count').default(0),
    /** 当日累计 token 数 */
    totalTokens: bigint('total_tokens', { mode: 'number' }).default(0),
    /** 当日累计成本(分) */
    totalCostCents: integer('total_cost_cents').default(0),
    /** 当日错误次数 */
    errorCount: integer('error_count').default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqueKeyDate: unique('ai_relay_channel_daily_usage_key_pool_id_usage_date_unique').on(
      t.keyPoolId,
      t.usageDate,
    ),
    dateIdx: index('idx_channel_daily_usage_date').on(t.usageDate),
    keyIdx: index('idx_channel_daily_usage_key').on(t.keyPoolId),
  }),
)

export type AiRelayChannelDailyUsage = typeof aiRelayChannelDailyUsage.$inferSelect
export type NewAiRelayChannelDailyUsage = typeof aiRelayChannelDailyUsage.$inferInsert

/**
 * API Key 分钟级用量统计 (api_key_minute_usage)。
 *
 * 由 apps/api/src/services/api-key-tpm-service.ts 以 raw SQL 读写(TPM 限流),
 * 补 TS schema 定义消除 dead migration 告警。
 * migration: 20260801010060_add_api_key_tpm_tags.sql
 */
export const apiKeyMinuteUsage = pgTable(
  'api_key_minute_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 关联 developer_api_keys.id(级联删除) */
    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => developerApiKeys.id, { onDelete: 'cascade' }),
    /** 统计分钟(UTC,按分钟聚合) */
    usageMinute: timestamp('usage_minute', { withTimezone: true }).notNull().defaultNow(),
    requestCount: integer('request_count').default(0),
    totalTokens: bigint('total_tokens', { mode: 'number' }).default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqueKeyMinute: unique('api_key_minute_usage_api_key_id_usage_minute_unique').on(
      t.apiKeyId,
      t.usageMinute,
    ),
    timeIdx: index('idx_api_key_minute_usage_time').on(t.usageMinute),
    keyIdx: index('idx_api_key_minute_usage_key').on(t.apiKeyId),
  }),
)

export type ApiKeyMinuteUsage = typeof apiKeyMinuteUsage.$inferSelect
export type NewApiKeyMinuteUsage = typeof apiKeyMinuteUsage.$inferInsert
