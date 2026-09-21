// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中转站分时(高峰/低谷)倍率服务(2026-09-16 立)。
 *
 * 职责:
 * 1. resolvePeakMultiplier — 给定模型 + 时刻,返回该时刻应叠加的分时倍率(无命中 = 1)
 * 2. listPeakPricingRules / createPeakPricingRule / updatePeakPricingRule / deletePeakPricingRule — 管理端 CRUD
 * 3. listPublicPeakWindows — 对外公示的时段倍率(模型广场展示用)
 *
 * 设计要点:
 * - **命中即用,不叠加**:同一时刻可能有高峰规则与低谷规则同时"覆盖"某模型,
 *   按 priority 降序取第一条命中,避免多规则连乘导致价格不可解释。
 * - **失败降级为 1**:任何异常(表未迁移/查询失败)都返回倍率 1,绝不因定价服务
 *   异常而抬高或阻断用户调用。
 * - **60s 内存缓存**:计费在每次 LLM 调用路径上,若每次都查库会显著增加延迟;
 *   规则是低频变更的运营配置,60s 陈旧窗口可接受。管理端写操作后调用
 *   invalidatePeakPricingCache() 立即失效,保证"改完即生效"。
 * - **时区固定 UTC+8**:中国无夏令时,与 tiered-pricing-service 的月度口径一致。
 */
import { eq, desc } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { relayPeakPricingRules, type RelayPeakPricingRule } from '@ihui/database'
import { normalizeModelId } from '@ihui/shared'

/** 管理端写入用入参(已过校验)。 */
export interface PeakPricingRuleInput {
  name: string
  modelId?: string | null
  providerCode?: string | null
  daysOfWeek: number[]
  startMinute: number
  endMinute: number
  multiplier: number
  priority?: number
  enabled?: boolean
  remark?: string | null
}

/** 分时倍率解析结果(带命中规则信息,便于日志与对外展示)。 */
export interface ResolvedPeakMultiplier {
  multiplier: number
  ruleId: string | null
  ruleName: string | null
}

/** 对外公示的时段倍率(模型广场用)。 */
export interface PublicPeakWindow {
  ruleName: string
  modelId: string | null
  daysOfWeek: number[]
  startMinute: number
  endMinute: number
  multiplier: number
}

const CACHE_TTL_MS = 60_000
const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000

let cache: { at: number; rules: RelayPeakPricingRule[] } | null = null

// =============================================================================
// 纯函数(可单测,无 IO)
// =============================================================================

/** 取 UTC+8 下的星期(0=周日..6=周六)与当日分钟数(0-1439)。 */
export function getUtc8WeekdayAndMinute(at: Date): { weekday: number; minute: number } {
  const shifted = new Date(at.getTime() + UTC8_OFFSET_MS)
  return {
    weekday: shifted.getUTCDay(),
    minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  }
}

/**
 * 判定规则是否命中给定时刻。
 *
 * - modelId 为空 = 适用全部模型;否则与归一化后的模型名精确相等才命中。
 * - daysOfWeek 为空 = 每天适用;否则需包含当天星期。
 * - 时段判定 [startMinute, endMinute):start < end 为同日区间;
 *   start > end 为跨天区间(如 23:00-07:00);start === end 视为全天。
 */
export function matchPeakRule(
  rule: Pick<
    RelayPeakPricingRule,
    'enabled' | 'modelId' | 'daysOfWeek' | 'startMinute' | 'endMinute'
  >,
  modelId: string,
  weekday: number,
  minute: number,
): boolean {
  if (!rule.enabled) return false
  if (rule.modelId && normalizeModelId(rule.modelId) !== normalizeModelId(modelId)) return false

  const days = Array.isArray(rule.daysOfWeek) ? (rule.daysOfWeek as unknown[]) : []
  if (days.length > 0 && !days.some((d) => Number(d) === weekday)) return false

  const s = Number(rule.startMinute)
  const e = Number(rule.endMinute)
  if (!Number.isFinite(s) || !Number.isFinite(e)) return false
  if (s === e) return true
  if (s < e) return minute >= s && minute < e
  // 跨天:如 23:00-07:00
  return minute >= s || minute < e
}

/** 校验规则入参,返回错误信息(undefined = 通过)。 */
export function validatePeakRuleInput(input: PeakPricingRuleInput): string | undefined {
  if (!input.name || input.name.trim().length === 0) return 'name_required'
  if (input.name.length > 64) return 'name_too_long'
  const days = input.daysOfWeek ?? []
  if (!Array.isArray(days) || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return 'days_of_week_invalid'
  }
  if (!Number.isInteger(input.startMinute) || input.startMinute < 0 || input.startMinute > 1439) {
    return 'start_minute_invalid'
  }
  if (!Number.isInteger(input.endMinute) || input.endMinute < 0 || input.endMinute > 1440) {
    return 'end_minute_invalid'
  }
  if (!Number.isFinite(input.multiplier) || input.multiplier < 0) return 'multiplier_invalid'
  if (input.multiplier > 100) return 'multiplier_too_large'
  return undefined
}

// =============================================================================
// 缓存与查询
// =============================================================================

/** 读取启用中的规则(按 priority 降序),带 60s 内存缓存。 */
async function loadEnabledRules(): Promise<RelayPeakPricingRule[]> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.rules
  const rows = await dbRead
    .select()
    .from(relayPeakPricingRules)
    .where(eq(relayPeakPricingRules.enabled, true))
    .orderBy(desc(relayPeakPricingRules.priority))
  cache = { at: now, rules: rows as RelayPeakPricingRule[] }
  return cache.rules
}

/** 清空缓存(管理端写操作后调用,保证改完即生效)。 */
export function invalidatePeakPricingCache(): void {
  cache = null
}

/**
 * 解析某模型在某时刻的分时倍率。
 *
 * 失败时返回 1(不加价),保证调用链不被定价配置异常阻断。
 */
export async function resolvePeakMultiplier(
  modelId: string,
  at: Date = new Date(),
): Promise<ResolvedPeakMultiplier> {
  try {
    const rules = await loadEnabledRules()
    if (rules.length === 0) return { multiplier: 1, ruleId: null, ruleName: null }
    const { weekday, minute } = getUtc8WeekdayAndMinute(at)
    for (const r of rules) {
      if (!matchPeakRule(r, modelId, weekday, minute)) continue
      const m = Number(r.multiplier)
      if (!Number.isFinite(m) || m < 0) continue
      return { multiplier: m, ruleId: r.id, ruleName: r.name }
    }
    return { multiplier: 1, ruleId: null, ruleName: null }
  } catch {
    return { multiplier: 1, ruleId: null, ruleName: null }
  }
}

/** 对外公示用的时段倍率清单(仅启用规则,按 priority 降序)。 */
export async function listPublicPeakWindows(): Promise<PublicPeakWindow[]> {
  try {
    const rules = await loadEnabledRules()
    return rules.map((r) => ({
      ruleName: r.name,
      modelId: r.modelId ?? null,
      daysOfWeek: Array.isArray(r.daysOfWeek) ? (r.daysOfWeek as number[]) : [],
      startMinute: Number(r.startMinute),
      endMinute: Number(r.endMinute),
      multiplier: Number(r.multiplier),
    }))
  } catch {
    return []
  }
}

// =============================================================================
// 管理端 CRUD
// =============================================================================

/** 列出全部分时倍率规则(管理端,含未启用)。 */
export async function listPeakPricingRules(): Promise<RelayPeakPricingRule[]> {
  const rows = await dbRead
    .select()
    .from(relayPeakPricingRules)
    .orderBy(desc(relayPeakPricingRules.priority), desc(relayPeakPricingRules.createdAt))
  return rows as RelayPeakPricingRule[]
}

/** 新建规则。 */
export async function createPeakPricingRule(
  input: PeakPricingRuleInput,
): Promise<RelayPeakPricingRule> {
  const [row] = await db
    .insert(relayPeakPricingRules)
    .values({
      name: input.name.trim(),
      modelId: input.modelId ? normalizeModelId(input.modelId) : null,
      providerCode: input.providerCode ?? null,
      daysOfWeek: input.daysOfWeek ?? [],
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      multiplier: input.multiplier,
      priority: input.priority ?? 0,
      enabled: input.enabled ?? true,
      remark: input.remark ?? null,
    })
    .returning()
  invalidatePeakPricingCache()
  return row as RelayPeakPricingRule
}

/** 更新规则(仅传需要改的字段)。 */
export async function updatePeakPricingRule(
  id: string,
  input: Partial<PeakPricingRuleInput>,
): Promise<RelayPeakPricingRule | null> {
  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.modelId !== undefined)
    patch.modelId = input.modelId ? normalizeModelId(input.modelId) : null
  if (input.providerCode !== undefined) patch.providerCode = input.providerCode
  if (input.daysOfWeek !== undefined) patch.daysOfWeek = input.daysOfWeek
  if (input.startMinute !== undefined) patch.startMinute = input.startMinute
  if (input.endMinute !== undefined) patch.endMinute = input.endMinute
  if (input.multiplier !== undefined) patch.multiplier = input.multiplier
  if (input.priority !== undefined) patch.priority = input.priority
  if (input.enabled !== undefined) patch.enabled = input.enabled
  if (input.remark !== undefined) patch.remark = input.remark

  const [row] = await db
    .update(relayPeakPricingRules)
    .set(patch)
    .where(eq(relayPeakPricingRules.id, id))
    .returning()
  invalidatePeakPricingCache()
  return (row as RelayPeakPricingRule) ?? null
}

/** 删除规则。 */
export async function deletePeakPricingRule(id: string): Promise<boolean> {
  const rows = await db
    .delete(relayPeakPricingRules)
    .where(eq(relayPeakPricingRules.id, id))
    .returning({ id: relayPeakPricingRules.id })
  invalidatePeakPricingCache()
  return rows.length > 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
