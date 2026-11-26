// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LLM 用户侧积分费率（成本加成，输入/输出分开）。
 *
 * 旧口径的 `points_multiplier` 是“总 token × 单档倍率”，输入和输出同价，
 * 无法覆盖输出远贵于输入的成本结构。本文件把 `ai_pricing` 的上游成本价
 * 直接换算成用户侧“积分/千 token”：
 *
 *   input_points_per_1k  = max(0.1, cost_input_price_per_1k  × 3, ai_pricing.input)
 *   output_points_per_1k = max(0.1, cost_output_price_per_1k × 3, ai_pricing.output)
 *
 * 成本优先取 `ai_model_config_models.cost_*_price_per_1k`（采购成本）×3；同时
 * 读取 `ai_pricing.input/output_token_price` 的 token 零售价作为下限（2026-11-26
 * 补）。零售价本身已含成本加成，直接作为下限，不能再×3 二次放大。这样
 * 「config cost=0」和「config cost 明显低于零售价」的模型都不会继续按 0.1
 * 地板价或过低倍率少收。
 *
 * 3 倍是配置成本的成本加成最低毛利线；0.1 积分/千 token 是绝对收费地板。
 * 两边都没有正价时返回 null，调用方必须 fail-closed，不能白送。
 */

import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { aiModelConfigModels, aiPricing } from '@ihui/database'
import { db } from '../db/index.js'

/** 成本加成倍数：3x 成本，覆盖支付通道/税费/基础设施前的毛利约 66.7%。 */
export const LLM_COST_MARKUP = 3
/** 任何模型的最低收费：0.1 积分/千 token（即 ¥1/百万 token）。 */
export const LLM_MIN_POINTS_PER_1K = 0.1
/** 无成本价模型的结算兜底：30 积分/千 token（只用于上游已发生、又找不到定价的异步回调）。 */
export const LLM_UNKNOWN_POINTS_PER_1K = 30

export interface LlmPointsRates {
  /** 输入侧：积分/千 token */
  inputPointsPer1k: number
  /** 输出侧：积分/千 token */
  outputPointsPer1k: number
  /** 命中的 ai_pricing.model_id，便于审计 */
  pricingModelId: string
  /** 上游成本价（分/千 token），仅用于日志/审计 */
  inputCostPer1k: number
  outputCostPer1k: number
  /** 展示用单值：取输入/输出较高的一侧 */
  displayMultiplier: number
}

interface CacheEntry {
  value: LlmPointsRates | null
  expiresAt: number
}

const CACHE_TTL_MS = 60_000
const NEGATIVE_CACHE_TTL_MS = 30_000
const cache = new Map<string, CacheEntry>()

/** 测试/后台改价后主动失效。 */
export function clearLlmPointsRatesCache(): void {
  cache.clear()
}

function candidateModelIds(modelId: string): string[] {
  const raw = modelId.trim()
  if (!raw) return []
  const lower = raw.toLowerCase()
  const bare = lower.includes('/') ? lower.split('/').pop()! : lower
  const colonBare = lower.includes(':') ? lower.split(':').pop()! : lower
  const out = new Set<string>([raw, lower, bare, colonBare])
  // 某些目录是 `provider:model`，ai_pricing 里只存裸模型名。
  if (lower.includes(':')) out.add(lower.replace(/^[^:]+:/, ''))
  return [...out].filter(Boolean)
}

/**
 * 读取模型当前 token 费率。
 * 依次尝试原始 id / 小写 / 裸模型名 / provider 前缀剥离，命中即缓存。
 */
export async function getLlmPointsRates(modelId: string): Promise<LlmPointsRates | null> {
  const cacheKey = modelId.trim().toLowerCase()
  if (!cacheKey) return null
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  let costRow:
    | { modelId: string; costInput: string | number | null; costOutput: string | number | null }
    | undefined
  for (const candidate of candidateModelIds(modelId)) {
    const [row] = await db
      .select({
        modelId: aiModelConfigModels.modelId,
        costInput: sql<string | null>`max(${aiModelConfigModels.costInputPricePer1k})`,
        costOutput: sql<string | null>`max(${aiModelConfigModels.costOutputPricePer1k})`,
      })
      .from(aiModelConfigModels)
      .where(
        and(
          eq(aiModelConfigModels.enabled, true),
          sql`lower(${aiModelConfigModels.modelId}) = ${candidate.toLowerCase()}`,
          isNotNull(aiModelConfigModels.costInputPricePer1k),
          isNotNull(aiModelConfigModels.costOutputPricePer1k),
        ),
      )
      .groupBy(aiModelConfigModels.modelId)
      .limit(1)
    if (row) {
      costRow = row
      break
    }
  }

  const inputCost = costRow ? Number(costRow.costInput) : 0
  const outputCost = costRow ? Number(costRow.costOutput) : 0
  const configUsable =
    Boolean(costRow) &&
    Number.isFinite(inputCost) &&
    Number.isFinite(outputCost) &&
    inputCost > 0 &&
    outputCost > 0

  // 2026-11-26:无论 config 成本是否可用,都读取 ai_pricing 的 token 零售价,
  // 并用它作为积分/千 token 的下限。零售价本身已含成本加成,直接作为下限,
  // 不再×3;这样「config cost=0」和「config cost 明显低于零售价」的模型
  // 都不会继续按 0.1 地板价或低倍率少收。
  let tokenPriceRow:
    | {
        modelId: string
        inputTokenPrice: string | number | null
        outputTokenPrice: string | number | null
      }
    | undefined
  for (const candidate of candidateModelIds(modelId)) {
    const [row] = await db
      .select({
        modelId: aiPricing.modelId,
        inputTokenPrice: aiPricing.inputTokenPrice,
        outputTokenPrice: aiPricing.outputTokenPrice,
      })
      .from(aiPricing)
      .where(
        and(
          sql`lower(${aiPricing.modelId}) = ${candidate.toLowerCase()}`,
          sql`${aiPricing.effectiveAt} <= now()`,
          sql`(${aiPricing.expiresAt} IS NULL OR ${aiPricing.expiresAt} > now())`,
          eq(aiPricing.billingMode, 'token'),
          sql`${aiPricing.inputTokenPrice} > 0`,
          sql`${aiPricing.outputTokenPrice} > 0`,
        ),
      )
      .orderBy(desc(aiPricing.effectiveAt))
      .limit(1)
    if (row) {
      tokenPriceRow = row
      break
    }
  }

  const listInput = tokenPriceRow ? Number(tokenPriceRow.inputTokenPrice) : 0
  const listOutput = tokenPriceRow ? Number(tokenPriceRow.outputTokenPrice) : 0
  const listUsable =
    Boolean(tokenPriceRow) &&
    Number.isFinite(listInput) &&
    Number.isFinite(listOutput) &&
    listInput > 0 &&
    listOutput > 0

  if (!configUsable && !listUsable) {
    cache.set(cacheKey, { value: null, expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS })
    return null
  }

  const round6 = (n: number) => Math.round(n * 1e6) / 1e6
  const inputPointsPer1k = round6(
    Math.max(
      LLM_MIN_POINTS_PER_1K,
      configUsable ? inputCost * LLM_COST_MARKUP : 0,
      listUsable ? listInput : 0,
    ),
  )
  const outputPointsPer1k = round6(
    Math.max(
      LLM_MIN_POINTS_PER_1K,
      configUsable ? outputCost * LLM_COST_MARKUP : 0,
      listUsable ? listOutput : 0,
    ),
  )
  const rates: LlmPointsRates = {
    inputPointsPer1k,
    outputPointsPer1k,
    pricingModelId: costRow?.modelId ?? tokenPriceRow?.modelId ?? '',
    inputCostPer1k: configUsable ? inputCost : listInput,
    outputCostPer1k: configUsable ? outputCost : listOutput,
    displayMultiplier: Math.max(inputPointsPer1k, outputPointsPer1k),
  }
  cache.set(cacheKey, { value: rates, expiresAt: Date.now() + CACHE_TTL_MS })
  return rates
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
