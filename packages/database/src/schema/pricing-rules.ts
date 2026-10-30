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
  unique,
} from 'drizzle-orm/pg-core'

/**
 * G4 计费弹性 - 组合定价规则表(pricing_rules,2026-10-30 立)。
 *
 * 与既有定价面的关系(不替换、只叠加):
 * - `ai_pricing`(模型基础单价,token/per_call/per_image/per_video 四模式)仍是存量结算真源;
 * - `tiered_pricing_rules`(月度用量阶梯降价)语义独立,本表不覆盖它;
 * - 本表承载"基础价 × 会员档位系数 × 错峰时段系数"的组合定价,由
 *   apps/api/src/services/pricing-engine.ts 解析,PRICING_RULES_ENABLED 开关灰度接入。
 *
 * 词表纪律(全部 varchar 封闭集,不引入 pg enum,同 devices.status 的取舍):
 * - mode 对齐 ai_pricing.billing_mode 四档:token | per_call | per_image | per_video;
 * - 档位键对齐既有会员/计费分组体系(users.is_vip 0=普通/1=VIP 与 user_billing_groups
 *   的 default/vip/svip 分组词表):member(普通)/vip/svip,未知档位系数按 1.0 处理;
 * - rule_key 即模型标识,'*' 表示全局兜底规则(同 tiered_pricing_rules.model_id 的约定)。
 *
 * 金额单位与 ai_pricing 一致:分(numeric 保留 6 位小数,极廉价模型 round 不归零)。
 * currency 列同时充当计价单位:货币码(CNY/USD)或 'credits'(积分)。
 */

/** 计费模式封闭集(对齐 ai_pricing.billing_mode) */
export const PRICING_RULE_MODES = ['token', 'per_call', 'per_image', 'per_video'] as const
export type PricingRuleMode = (typeof PRICING_RULE_MODES)[number]

/** 会员档位键封闭集(对齐 users.is_vip 与 user_billing_groups 的 default/vip/svip 词表) */
export const PRICING_TIER_KEYS = ['member', 'vip', 'svip'] as const
export type PricingTierKey = (typeof PRICING_TIER_KEYS)[number]

/** tier_multipliers jsonb 形态:档位键 → 系数(0.80 = 8 折,1.00 = 原价) */
export type TierMultipliers = Partial<Record<PricingTierKey, number>> &
  Record<string, number | undefined>

/** time_of_day_factor jsonb 单个窗口的取值:系数 + 时区(缺省 Asia/Shanghai) */
export interface TimeOfDayWindow {
  /** 时段系数(0.5 = 错峰半价) */
  factor: number
  /** IANA 时区名,判定"当地几点"用;缺省按 Asia/Shanghai */
  tz?: string
}

/**
 * time_of_day_factor jsonb 形态:窗口键 "HH:mm-HH:mm" → 系数与时区。
 * 跨日窗口(起点 > 终点,如 "23:00-07:00")按"当日 23:00 起至次日 07:00 止"判定,
 * 边界取 [start, end) 左闭右开。
 */
export type TimeOfDayFactor = Record<string, TimeOfDayWindow>

export const pricingRules = pgTable(
  'pricing_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 规则键 = 模型标识(如 'gpt-4o'),'*' 为全局兜底;全表唯一,编辑走 version 递增 */
    ruleKey: varchar('rule_key', { length: 128 }).notNull(),
    /** 展示名(用户面价格页用,如 "GPT-4o 组合价") */
    displayName: varchar('display_name', { length: 255 }).notNull(),
    /** 计价单位:货币码(CNY/USD)或 'credits'(积分);金额一律按"分/积分"存 numeric */
    currency: varchar('currency', { length: 16 }).default('CNY').notNull(),
    /** 计费模式:token | per_call | per_image | per_video(对齐 ai_pricing.billing_mode) */
    mode: varchar('mode', { length: 16 }).default('token').notNull(),
    /** 基础单价:token=分/千 token;per_call=分/次;per_image=分/张;per_video=分/次或分/秒 */
    basePrice: numeric('base_price', { precision: 18, scale: 6, mode: 'number' }).notNull(),
    /** 档位系数表 {"member":1.0,"vip":0.8,"svip":0.6};缺档位键按 1.0 */
    tierMultipliers: jsonb('tier_multipliers').notNull().default({}),
    /** 错峰时段系数表 {"23:00-07:00":{"factor":0.5,"tz":"Asia/Shanghai"}};null/{} = 不分时段 */
    timeOfDayFactor: jsonb('time_of_day_factor'),
    enabled: boolean('enabled').default(true).notNull(),
    /** 规则版本:每次编辑 +1,结算明细落 ruleVersion 供审计回溯 */
    version: integer('version').default(1).notNull(),
    /** 生效区间 [effectiveFrom, effectiveTo);effectiveTo null = 长期有效 */
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).defaultNow().notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // rule_key 全表唯一:同一模型同时只有一条现行规则,历史靠 version 递增覆盖而非多行并存。
    ruleKeyUniq: unique('pricing_rules_rule_key_unique').on(t.ruleKey),
    // 结算热路径查询:enabled + 生效区间过滤
    modeEnabledIdx: index('pricing_rules_mode_enabled_idx').on(t.mode, t.enabled),
    effectiveIdx: index('pricing_rules_effective_idx').on(t.effectiveFrom, t.effectiveTo),
  }),
)

export type PricingRule = typeof pricingRules.$inferSelect
export type NewPricingRule = typeof pricingRules.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
