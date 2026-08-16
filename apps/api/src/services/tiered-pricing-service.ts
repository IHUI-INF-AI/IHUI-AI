/**
 * 阶梯计价服务(2026-08-01 立,用得越多越便宜)。
 *
 * 月度用量达阈值自动降价,模型级独立累计。
 * 当月定义:UTC+8 当月 1 日 00:00 至当前。
 *
 * 匹配优先级:精确 model_id > '*' 全局规则。
 * 阶梯选取:按 from_tokens 升序,取累计 token 落入的最高阶梯。
 */
import { eq, and, gte, or, like, sql, asc } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { tieredPricingRules, llmCallLogs, type TieredPricingRule } from '@ihui/database'

// =============================================================================
// 类型定义
// =============================================================================

export interface CurrentTierResult {
  /** 当前阶梯倍率(1.00 = 原价,0.80 = 8折) */
  multiplier: number
  /** 当月累计 token 数 */
  currentTokens: number
  /** 下一阶梯起点(null = 已是最高阶梯) */
  nextTierThreshold: number | null
  /** 下一阶梯倍率(null = 已是最高阶梯) */
  nextTierMultiplier: number | null
}

export interface TieredProgressResult {
  /** 规范化后的模型名(去 LiteLLM 前缀) */
  model: string
  /** 当前阶梯倍率 */
  currentTierMultiplier: number
  /** 当月累计 token 数 */
  currentTokens: number
  /** 所有阶梯列表(按 fromTokens 升序) */
  tiers: Array<{
    fromTokens: number
    toTokens: number | null
    multiplier: number
    isCurrent: boolean
  }>
  /** 下一阶梯信息(null = 已是最高阶梯) */
  nextTier: {
    threshold: number
    multiplier: number
    tokensToNext: number
  } | null
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 去 LiteLLM 自定义前缀(stepfun/agnes),返回 DB 中存储的原始 model_id。
 * 与 relay-billing-service.ts 的 stripLiteLLMPrefix 逻辑一致。
 */
function stripLiteLLMPrefix(model: string): string {
  const slashIdx = model.indexOf('/')
  if (slashIdx > 0) {
    const prefix = model.slice(0, slashIdx)
    if (prefix === 'stepfun' || prefix === 'agnes') {
      return model.slice(slashIdx + 1)
    }
  }
  return model
}

/**
 * 获取 UTC+8 当月 1 日 00:00:00 对应的 UTC Date。
 * 当月定义:UTC+8 当月 1 日 00:00 至当前。
 */
function getCurrentMonthStartUtc8(): Date {
  const now = new Date()
  // 转为 UTC+8 时间
  const utc8Ms = now.getTime() + 8 * 60 * 60 * 1000
  const utc8Date = new Date(utc8Ms)
  // UTC+8 当月 1 日 00:00:00(以 UTC 表示)
  const monthStartUtc8 = new Date(Date.UTC(utc8Date.getUTCFullYear(), utc8Date.getUTCMonth(), 1))
  // 转回 UTC
  return new Date(monthStartUtc8.getTime() - 8 * 60 * 60 * 1000)
}

/**
 * 查询指定模型的阶梯规则(精确 model_id 优先,无则回退 '*' 全局规则)。
 * 返回按 fromTokens 升序排列的启用的规则列表。
 */
async function getRulesForModel(dbModelId: string): Promise<TieredPricingRule[]> {
  // 1. 先查精确 model_id 的规则
  const specificRules = await dbRead
    .select()
    .from(tieredPricingRules)
    .where(and(eq(tieredPricingRules.modelId, dbModelId), eq(tieredPricingRules.enabled, true)))
    .orderBy(asc(tieredPricingRules.fromTokens))

  if (specificRules.length > 0) return specificRules

  // 2. 回退到 '*' 全局规则
  return dbRead
    .select()
    .from(tieredPricingRules)
    .where(and(eq(tieredPricingRules.modelId, '*'), eq(tieredPricingRules.enabled, true)))
    .orderBy(asc(tieredPricingRules.fromTokens))
}

/**
 * 从规则列表中找到当前阶梯索引(最后一个 fromTokens <= currentTokens 的规则)。
 * 规则列表为空 → 返回 -1。
 */
function findCurrentTierIndex(rules: TieredPricingRule[], currentTokens: number): number {
  if (rules.length === 0) return -1
  let idx = 0
  for (let i = 0; i < rules.length; i++) {
    if (rules[i]!.fromTokens <= currentTokens) {
      idx = i
    } else {
      break
    }
  }
  return idx
}

/** 解析 numeric 倍率为 number(默认 1.0) */
function parseMultiplier(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 1
}

// =============================================================================
// 1. getMonthlyTokenUsage — 查用户当月(model 级)累计 token
// =============================================================================

/**
 * 查用户当月(UTC+8)指定模型的累计 token 用量。
 *
 * llm_call_logs.model 可能存带 LiteLLM 前缀的原始模型名(如 'stepfun/gpt-4o'),
 * 也会存不带前缀的(如 'gpt-4o'),两者都计入累计。
 */
export async function getMonthlyTokenUsage(userId: string, model: string): Promise<number> {
  const dbModelId = stripLiteLLMPrefix(model)
  const monthStart = getCurrentMonthStartUtc8()

  // 匹配 model = dbModelId OR model LIKE '%/dbModelId'(覆盖带前缀的变体)
  const [row] = await dbRead
    .select({
      total: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
    })
    .from(llmCallLogs)
    .where(
      and(
        eq(llmCallLogs.userId, userId),
        or(eq(llmCallLogs.model, dbModelId), like(llmCallLogs.model, `%/${dbModelId}`)),
        gte(llmCallLogs.createdAt, monthStart),
      ),
    )

  return row?.total ?? 0
}

// =============================================================================
// 2. getCurrentTierMultiplier — 查当前阶梯倍率
// =============================================================================

/**
 * 查用户当前阶梯倍率(基于当月累计 token)。
 * 无阶梯规则配置时返回 multiplier = 1.0(原价)。
 */
export async function getCurrentTierMultiplier(
  userId: string,
  model: string,
): Promise<CurrentTierResult> {
  const dbModelId = stripLiteLLMPrefix(model)
  const currentTokens = await getMonthlyTokenUsage(userId, model)
  const rules = await getRulesForModel(dbModelId)

  if (rules.length === 0) {
    return {
      multiplier: 1,
      currentTokens,
      nextTierThreshold: null,
      nextTierMultiplier: null,
    }
  }

  const currentIdx = findCurrentTierIndex(rules, currentTokens)
  const currentTier = rules[currentIdx]!

  const nextTier = currentIdx + 1 < rules.length ? rules[currentIdx + 1]! : null

  return {
    multiplier: parseMultiplier(currentTier.multiplier),
    currentTokens,
    nextTierThreshold: nextTier ? nextTier.fromTokens : null,
    nextTierMultiplier: nextTier ? parseMultiplier(nextTier.multiplier) : null,
  }
}

// =============================================================================
// 3. getTieredProgress — 查进度(前端进度条用)
// =============================================================================

/**
 * 查用户当月阶梯进度(前端进度条用)。
 * 无阶梯规则配置时返回空 tiers + multiplier = 1.0。
 */
export async function getTieredProgress(
  userId: string,
  model: string,
): Promise<TieredProgressResult> {
  const dbModelId = stripLiteLLMPrefix(model)
  const currentTokens = await getMonthlyTokenUsage(userId, model)
  const rules = await getRulesForModel(dbModelId)

  if (rules.length === 0) {
    return {
      model: dbModelId,
      currentTierMultiplier: 1,
      currentTokens,
      tiers: [],
      nextTier: null,
    }
  }

  const currentIdx = findCurrentTierIndex(rules, currentTokens)
  const nextTier = currentIdx + 1 < rules.length ? rules[currentIdx + 1]! : null

  return {
    model: dbModelId,
    currentTierMultiplier: parseMultiplier(rules[currentIdx]!.multiplier),
    currentTokens,
    tiers: rules.map((r, i) => ({
      fromTokens: r.fromTokens,
      toTokens: r.toTokens,
      multiplier: parseMultiplier(r.multiplier),
      isCurrent: i === currentIdx,
    })),
    nextTier: nextTier
      ? {
          threshold: nextTier.fromTokens,
          multiplier: parseMultiplier(nextTier.multiplier),
          tokensToNext: Math.max(0, nextTier.fromTokens - currentTokens),
        }
      : null,
  }
}
