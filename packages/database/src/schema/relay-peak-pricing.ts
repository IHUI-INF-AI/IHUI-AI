// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

/**
 * 中转站分时(高峰/低谷)倍率规则表(relay_peak_pricing_rules,2026-09-16 立)。
 *
 * 用途:让对外售卖的中转站定价支持"按时段浮动"——例如工作日 09:00-18:00
 * 上游拥堵、成本上浮,倍率 ×1.5;深夜 00:00-08:00 需求低,倍率 ×0.8。
 *
 * 设计:
 * - 规则按 priority 降序、命中即用(不叠加),保证同一时刻同一模型只有一个倍率,
 *   避免多规则连乘导致价格不可解释。
 * - modelId 为空 = 全模型通用;providerCode 为空 = 全渠道通用。
 * - daysOfWeek 为 0-6(0=周日)数组,空数组 = 每天适用。
 * - 时段用"当日分钟数"表示 [startMinute, endMinute):
 *   09:00 → 540,18:00 → 1080。startMinute > endMinute 表示跨天
 *   (如 23:00-07:00 → 1380 至 420)。
 * - multiplier 为 decimal(10,4),1.0000 = 不加价;0 = 该时段免费(慎用)。
 * - 生效时段判定统一按 UTC+8(中国无夏令时),与计费与订阅窗口口径一致。
 *
 * 影响面:仅当存在启用规则且命中时,calculateCost 的倍率链才追加该因子;
 * 无规则(或全部未命中)时倍率为 1,既有账单不受任何影响。
 */
export const relayPeakPricingRules = pgTable(
  'relay_peak_pricing_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 规则名(管理端可读) */
    name: varchar('name', { length: 64 }).notNull(),
    /** 适用模型 id(归一后的模型名);为空 = 全部模型 */
    modelId: varchar('model_id', { length: 128 }),
    /** 适用上游渠道 provider_code;为空 = 全部渠道 */
    providerCode: varchar('provider_code', { length: 64 }),
    /** 适用星期(0=周日..6=周六);空数组 = 每天 */
    daysOfWeek: jsonb('days_of_week').notNull().default([]),
    /** 起始分钟(含),0-1439 */
    startMinute: integer('start_minute').notNull(),
    /** 结束分钟(不含),0-1440;小于 startMinute 表示跨天 */
    endMinute: integer('end_minute').notNull(),
    /** 倍率(1.0000 = 原价) */
    multiplier: numeric('multiplier', { precision: 10, scale: 4, mode: 'number' }).notNull(),
    /** 优先级(数值大者优先,命中即用) */
    priority: integer('priority').default(0).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    remark: varchar('remark', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    enabledPriorityIdx: index('relay_peak_pricing_rules_enabled_idx').on(t.enabled, t.priority),
    modelIdx: index('relay_peak_pricing_rules_model_idx').on(t.modelId),
  }),
)

export type RelayPeakPricingRule = typeof relayPeakPricingRules.$inferSelect
export type NewRelayPeakPricingRule = typeof relayPeakPricingRules.$inferInsert
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
