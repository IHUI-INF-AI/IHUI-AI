// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, eq, gt, isNull, or, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  pricingRules,
  type PricingRule,
  type PricingRuleMode,
  type TimeOfDayFactor,
  type TimeOfDayWindow,
} from '@ihui/database'

/**
 * G4 组合定价解析引擎(2026-10-30 立)。
 *
 * 职责:把 pricing_rules 的"基础价 × 会员档位系数 × 错峰时段系数"链解析成单一
 * unitPrice,并保留可审计的系数链明细(breakdown)。
 *
 * 设计纪律:
 * - 纯函数核(pickRule / parseTimeOfDayFactor / applyRule)与 db 读取(loadActiveRules)
 *   分离,resolvePrice 的 loadRules 可注入,单测无需真库;
 * - 无匹配规则时返回 null,由调用方(结算面)回退 ai-cost-tracker / pricing-service
 *   既有定价路径,保证存量结算行为逐字节不变;
 * - 错峰判定按规则内 tz(IANA 时区名,缺省 Asia/Shanghai),跨日窗口(起点 > 终点,
 *   如 23:00-07:00)按"当日 23:00 起至次日 07:00 止"判定,边界 [start, end) 左闭右开;
 * - 金额单位与 ai_pricing 一致(分),roundCents 保留 6 位小数,同 pricing-service 口径。
 */

// =============================================================================
// 类型
// =============================================================================

export interface ResolvePriceInput {
  /** 计费模式(对齐 ai_pricing.billing_mode 四档) */
  mode: PricingRuleMode
  /** 模型标识(如 'gpt-4o'),与 pricing_rules.rule_key 匹配 */
  modelId: string
  /** 会员档位键(member/vip/svip 或计费分组名);null/缺省/未知档位 ⇒ 系数按 1.0 */
  tier?: string | null
  /** 计价时刻(缺省 new Date());错峰窗口按本时刻在规则 tz 下的"当地时分"判定 */
  timestamp?: Date
}

/** 系数链明细项:kind 标注环节, factor 为该环节实际乘入的系数 */
export interface PriceBreakdownItem {
  kind: 'base' | 'tier' | 'time_of_day'
  label: string
  factor: number
}

export interface ResolvedPrice {
  /** 最终单价 = basePrice × 档位系数 × 错峰系数(分,6 位小数;单位语义随 mode) */
  unitPrice: number
  ruleId: string
  ruleVersion: number
  /** 计价单位:货币码(CNY/USD)或 'credits' */
  currency: string
  mode: PricingRuleMode
  breakdown: PriceBreakdownItem[]
}

export interface ResolvePriceDeps {
  /** 可注入的规则装载器(单测桩);缺省走 db.loadActiveRules */
  loadRules?: (now: Date) => Promise<PricingRule[]>
}

// =============================================================================
// 常量
// =============================================================================

const DEFAULT_TZ = 'Asia/Shanghai'
const roundCents = (v: number): number => Math.round(v * 1e6) / 1e6

/** 系数合法性:必须是有限非负数;否则按 1.0(不炸结算,坏配置退化为无系数) */
function safeFactor(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 1.0
}

// =============================================================================
// 纯函数核
// =============================================================================

/**
 * 从生效规则集中挑一条:精确 rule_key === modelId 优先,其次 '*' 全局兜底;
 * mode 必须一致。与 tiered_pricing_rules 的"精确 > '*'"优先级约定同源。
 */
export function pickRule(
  rules: PricingRule[],
  mode: PricingRuleMode,
  modelId: string,
): PricingRule | undefined {
  const candidates = rules.filter((r) => r.mode === mode)
  return candidates.find((r) => r.ruleKey === modelId) ?? candidates.find((r) => r.ruleKey === '*')
}

/** 解析 "HH:mm-HH:mm" → [起分, 止分](当日 0 点起分钟数);非法形态返回 null */
export function parseWindowKey(key: string): [number, number] | null {
  const m = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(key.trim())
  if (!m) return null
  const sh = Number(m[1])
  const sm = Number(m[2])
  const eh = Number(m[3])
  const em = Number(m[4])
  if (sh > 23 || sm > 59 || eh > 23 || em > 59) return null
  return [sh * 60 + sm, eh * 60 + em]
}

/**
 * 时刻是否落入窗口(分钟域,[start,end) 左闭右开)。
 * 跨日窗口(start > end,如 23:00-07:00):m >= start 或 m < end 即命中;
 * start === end 视为空窗口(不命中),避免"全天"歧义 —— 全天统一价请留空配置。
 */
export function isInTimeWindow(startMin: number, endMin: number, minuteOfDay: number): boolean {
  if (startMin === endMin) return false
  if (startMin < endMin) return minuteOfDay >= startMin && minuteOfDay < endMin
  return minuteOfDay >= startMin || minuteOfDay < endMin
}

/** 取 timestamp 在 tz 下的"当地时分"(0 点起分钟数);非法 tz 回退 DEFAULT_TZ */
export function localMinuteOfDay(timestamp: Date, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(timestamp)
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
    return hour * 60 + minute
  } catch {
    return localMinuteOfDay(timestamp, DEFAULT_TZ)
  }
}

/**
 * 错峰系数解析:遍历规则 time_of_day_factor,命中窗口取该窗口系数;
 * 多窗口同时命中(配置重叠)取**最低系数**(错峰优惠优先,与"无匹配 = 1.0"纪律一致)。
 */
export function resolveTimeOfDayFactor(
  factorMap: TimeOfDayFactor | null | undefined,
  timestamp: Date,
): { factor: number; window: string | null } {
  if (!factorMap || typeof factorMap !== 'object') return { factor: 1.0, window: null }
  let best: { factor: number; window: string | null } = { factor: 1.0, window: null }
  let hit = false
  for (const [key, spec] of Object.entries(factorMap)) {
    const win = parseWindowKey(key)
    if (!win) continue
    const s = (spec ?? {}) as Partial<TimeOfDayWindow>
    const tz = typeof s.tz === 'string' && s.tz ? s.tz : DEFAULT_TZ
    if (!isInTimeWindow(win[0], win[1], localMinuteOfDay(timestamp, tz))) continue
    const f = safeFactor(s.factor)
    if (!hit || f < best.factor) best = { factor: f, window: key }
    hit = true
  }
  return best
}

/**
 * 对单条规则应用档位 + 错峰系数,产出 ResolvedPrice(纯函数,不落库不查库)。
 */
export function applyRule(
  rule: PricingRule,
  input: { tier?: string | null; timestamp?: Date },
): ResolvedPrice {
  const now = input.timestamp ?? new Date()
  const tier = input.tier ?? null
  const multipliers = (rule.tierMultipliers ?? {}) as Record<string, unknown>
  const tierFactor = tier && tier in multipliers ? safeFactor(multipliers[tier]) : 1.0
  const tod = resolveTimeOfDayFactor((rule.timeOfDayFactor ?? null) as TimeOfDayFactor | null, now)
  const basePrice = safeFactor(rule.basePrice)
  const unitPrice = roundCents(basePrice * tierFactor * tod.factor)
  const breakdown: PriceBreakdownItem[] = [
    { kind: 'base', label: rule.ruleKey, factor: basePrice },
    { kind: 'tier', label: tier ?? 'default', factor: tierFactor },
    { kind: 'time_of_day', label: tod.window ?? 'off-peak:none', factor: tod.factor },
  ]
  return {
    unitPrice,
    ruleId: rule.id,
    ruleVersion: rule.version,
    currency: rule.currency,
    mode: rule.mode as PricingRuleMode,
    breakdown,
  }
}

// =============================================================================
// db 读取 + 对外入口
// =============================================================================

/** 装载当前生效规则:enabled 且 effective_from <= now < effective_to(null = 长期)。 */
export async function loadActiveRules(now: Date): Promise<PricingRule[]> {
  return db
    .select()
    .from(pricingRules)
    .where(
      and(
        eq(pricingRules.enabled, true),
        lte(pricingRules.effectiveFrom, now),
        or(isNull(pricingRules.effectiveTo), gt(pricingRules.effectiveTo, now)),
      ),
    )
}

/**
 * 解析一次组合定价。
 * 命中规则 → ResolvedPrice;无生效规则/库异常 → null(调用方回退既有定价路径,
 * 保持存量结算行为兼容,绝不因新面故障抬高或清零成本)。
 */
export async function resolvePrice(
  input: ResolvePriceInput,
  deps: ResolvePriceDeps = {},
): Promise<ResolvedPrice | null> {
  const now = input.timestamp ?? new Date()
  try {
    const loader = deps.loadRules ?? loadActiveRules
    const rules = await loader(now)
    const rule = pickRule(rules, input.mode, input.modelId)
    if (!rule) return null
    return applyRule(rule, { tier: input.tier ?? null, timestamp: now })
  } catch {
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
