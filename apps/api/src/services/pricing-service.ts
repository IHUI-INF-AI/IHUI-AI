/**
 * AI 定价计算引擎。
 * 给定 input/output token 数量 + 模型定价 + 区域 + 折扣 → 计算最终成本。
 * 金额单位: 分（整数），避免浮点数精度问题。
 */
import { eq, and, lte, gt, or, isNull, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { aiPricing, type AiPricing } from '@ihui/database'

// =============================================================================
// 类型定义
// =============================================================================

export interface CalculateCostParams {
  modelId: string
  inputTokens: number
  outputTokens: number
  region?: string // 默认 'cn'
  discountCode?: string // 预留: 折扣码（当前折扣规则以定价配置内的 discount 为准）
}

export interface CalculateCostResult {
  inputCost: number // 输入 token 成本（分）
  outputCost: number // 输出 token 成本（分）
  regionMultiplier: number // 区域系数
  discountMultiplier: number // 折扣系数
  totalCost: number // 总成本（分）
  currency: string
}

export interface UpsertPricingInput {
  modelId: string
  inputTokenPrice: number
  outputTokenPrice: number
  regionPricing?: Record<string, number>
  discount?: unknown
  currency?: string
  effectiveAt?: Date
  expiresAt?: Date | null
}

// =============================================================================
// 常量
// =============================================================================

const DEFAULT_REGION = 'cn'
const DEFAULT_REGION_MULTIPLIER = 1.0
const DEFAULT_DISCOUNT_MULTIPLIER = 1.0
const DEFAULT_CURRENCY = 'CNY'

// =============================================================================
// 折扣计算
// =============================================================================

/**
 * 根据折扣规则计算折扣系数。
 * discount 结构: { type: 'percentage', value: 0~1, minTokens?: number }
 *  - percentage: value 为 0~1 之间的系数（如 0.8 = 8 折），低于 minTokens 不生效。
 * 返回 discountMultiplier（乘法系数）；不支持的类型按无折扣处理。
 */
function computeDiscountMultiplier(discount: unknown, totalTokens: number): number {
  if (!discount || typeof discount !== 'object') return DEFAULT_DISCOUNT_MULTIPLIER
  const d = discount as Record<string, unknown>
  const minTokens = typeof d.minTokens === 'number' ? d.minTokens : 0
  if (totalTokens < minTokens) return DEFAULT_DISCOUNT_MULTIPLIER

  if (d.type === 'percentage') {
    const v = typeof d.value === 'number' ? d.value : 1
    if (v <= 0 || v > 1) return DEFAULT_DISCOUNT_MULTIPLIER
    return v
  }
  return DEFAULT_DISCOUNT_MULTIPLIER
}

// =============================================================================
// 定价查询
// =============================================================================

/**
 * 读取模型当前生效定价。
 * 优先取 effectiveAt <= now 且（expiresAt 为空 或 expiresAt > now）的最新一条。
 */
export async function findActivePricing(modelId: string): Promise<AiPricing | undefined> {
  const now = new Date()
  const rows = await db
    .select()
    .from(aiPricing)
    .where(
      and(
        eq(aiPricing.modelId, modelId),
        lte(aiPricing.effectiveAt, now),
        or(isNull(aiPricing.expiresAt), gt(aiPricing.expiresAt, now)),
      ),
    )
    .orderBy(desc(aiPricing.effectiveAt))
    .limit(1)
  return rows[0]
}

/** 列出所有模型定价配置（按生效时间倒序）。 */
export async function listPricing(): Promise<AiPricing[]> {
  return db.select().from(aiPricing).orderBy(desc(aiPricing.effectiveAt))
}

/** 列出所有支持的区域（聚合所有定价配置的 regionPricing 键，始终包含 'cn'）。 */
export async function listSupportedRegions(): Promise<string[]> {
  const rows = await db.select({ regionPricing: aiPricing.regionPricing }).from(aiPricing)
  const regionSet = new Set<string>([DEFAULT_REGION])
  for (const row of rows) {
    const map = (row.regionPricing ?? {}) as Record<string, unknown>
    for (const key of Object.keys(map)) regionSet.add(key)
  }
  return Array.from(regionSet).sort()
}

// =============================================================================
// 定价写入
// =============================================================================

/**
 * 创建或更新模型定价（按 modelId 覆盖最新一条；若无则新增）。
 */
export async function upsertPricing(input: UpsertPricingInput): Promise<AiPricing> {
  const [existing] = await db
    .select()
    .from(aiPricing)
    .where(eq(aiPricing.modelId, input.modelId))
    .orderBy(desc(aiPricing.effectiveAt))
    .limit(1)

  if (existing) {
    const rows = await db
      .update(aiPricing)
      .set({
        inputTokenPrice: input.inputTokenPrice,
        outputTokenPrice: input.outputTokenPrice,
        regionPricing: input.regionPricing ?? (existing.regionPricing as Record<string, number>),
        discount: input.discount ?? existing.discount,
        currency: input.currency ?? existing.currency,
        expiresAt: input.expiresAt === undefined ? existing.expiresAt : input.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(aiPricing.id, existing.id))
      .returning()
    const updated = rows[0]
    if (!updated) throw new Error('定价更新失败')
    return updated
  }

  const rows = await db
    .insert(aiPricing)
    .values({
      modelId: input.modelId,
      inputTokenPrice: input.inputTokenPrice,
      outputTokenPrice: input.outputTokenPrice,
      regionPricing: input.regionPricing ?? { cn: 1.0 },
      discount: input.discount ?? null,
      currency: input.currency ?? DEFAULT_CURRENCY,
      effectiveAt: input.effectiveAt ?? new Date(),
      expiresAt: input.expiresAt ?? null,
    })
    .returning()
  const created = rows[0]
  if (!created) throw new Error('定价创建失败')
  return created
}

// =============================================================================
// 成本计算
// =============================================================================

/**
 * AI 定价计算引擎核心。
 * 流程: 读取定价 → 计算 input/output 成本 → 应用区域系数 → 应用折扣系数 → 汇总。
 * 模型无定价配置时回退 0 成本（调用方应据此记录 warning）。
 */
export async function calculateCost(params: CalculateCostParams): Promise<CalculateCostResult> {
  const region = params.region ?? DEFAULT_REGION
  const pricing = await findActivePricing(params.modelId)

  // 无定价配置: 回退 0 成本
  if (!pricing) {
    return {
      inputCost: 0,
      outputCost: 0,
      regionMultiplier: DEFAULT_REGION_MULTIPLIER,
      discountMultiplier: DEFAULT_DISCOUNT_MULTIPLIER,
      totalCost: 0,
      currency: DEFAULT_CURRENCY,
    }
  }

  // inputCost = (inputTokens / 1000) * inputTokenPrice（分，四舍五入到整数）
  const inputCost = Math.round((params.inputTokens / 1000) * pricing.inputTokenPrice)
  const outputCost = Math.round((params.outputTokens / 1000) * pricing.outputTokenPrice)

  // 区域系数
  const regionMap = (pricing.regionPricing ?? {}) as Record<string, number>
  const regionMultiplier =
    typeof regionMap[region] === 'number' ? regionMap[region] : DEFAULT_REGION_MULTIPLIER

  // 折扣系数
  const totalTokens = params.inputTokens + params.outputTokens
  const discountMultiplier = computeDiscountMultiplier(pricing.discount, totalTokens)

  // totalCost = (inputCost + outputCost) * regionMultiplier * discountMultiplier（分，整数）
  const totalCost = Math.round((inputCost + outputCost) * regionMultiplier * discountMultiplier)

  return {
    inputCost,
    outputCost,
    regionMultiplier,
    discountMultiplier,
    totalCost,
    currency: pricing.currency,
  }
}
