import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

/**
 * 阶梯计价规则表(2026-08-01 立,用得越多越便宜)。
 *
 * model_id: 模型名(如 'gpt-4o'),'*' 表示全局规则(对所有模型生效)。
 * from_tokens / to_tokens: 阶梯区间(含端点),to_tokens = null 表示无上限。
 * multiplier: 倍率(0.80 = 8折,1.00 = 原价)。
 *
 * 匹配优先级:精确 model_id > '*' 全局规则。
 * 阶梯选取:按 from_tokens 升序,取累计 token 落入的最高阶梯。
 * 当月定义:UTC+8 当月 1 日 00:00 至当前。
 */
export const tieredPricingRules = pgTable(
  'tiered_pricing_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 64 }).notNull(),
    /** 模型名,'*' 表示全局规则 */
    modelId: varchar('model_id', { length: 128 }).notNull(),
    /** 阶梯起点(含) */
    fromTokens: integer('from_tokens').notNull(),
    /** 阶梯终点(含),null 表示无上限 */
    toTokens: integer('to_tokens'),
    /** 倍率(0.80 = 8折) */
    multiplier: numeric('multiplier', { precision: 5, scale: 2 }).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    modelIdx: index('tiered_pricing_rules_model_idx').on(t.modelId),
    enabledIdx: index('tiered_pricing_rules_enabled_idx').on(t.enabled),
  }),
)

export type TieredPricingRule = typeof tieredPricingRules.$inferSelect
export type NewTieredPricingRule = typeof tieredPricingRules.$inferInsert
