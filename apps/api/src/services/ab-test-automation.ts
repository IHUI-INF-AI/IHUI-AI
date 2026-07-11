/**
 * A/B 测试自动化服务。
 *
 * 自动判断显著性 + 自动推广获胜方案：
 * - 显著性检验：双比例 Z 检验（对照组 vs 实验组转化率）
 * - 自动推广：p-value < 0.05 且样本量 ≥ 阈值 时，将 winningVariantId 写入 ab_tests
 * - 定时执行：由 scheduler 周期调用 evaluateAllRunningTests()
 */

import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { abTests, type AbTest } from '@ihui/database'
import { getTestStats, endTest, type VariantStat } from './ab-test-service.js'

export interface SignificanceResult {
  variantId: string
  variantName: string
  isWinner: boolean
  isSignificant: boolean
  pValue: number
  uplift: number // 相对对照组的提升率
  zScore: number
  reason: string
}

/** 双比例 Z 检验：返回 z-score 与 p-value（双侧）。 */
function twoProportionZTest(
  controlSamples: number,
  controlConversions: number,
  variantSamples: number,
  variantConversions: number,
): { zScore: number; pValue: number } {
  if (controlSamples === 0 || variantSamples === 0) {
    return { zScore: 0, pValue: 1 }
  }
  const p1 = controlConversions / controlSamples
  const p2 = variantConversions / variantSamples
  const pooledP = (controlConversions + variantConversions) / (controlSamples + variantSamples)
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / controlSamples + 1 / variantSamples))
  if (se === 0) return { zScore: 0, pValue: 1 }
  const z = (p2 - p1) / se
  // 双侧 p-value：用标准正态近似
  const pValue = 2 * (1 - normalCdf(Math.abs(z)))
  return { zScore: z, pValue }
}

/** 标准正态分布 CDF 近似（Abramowitz & Stegun 26.2.17）。 */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * x)
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2)
  const p =
    d *
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return 1 - p
}

/** 评估单个变体相对对照组的显著性。 */
export function evaluateVariant(control: VariantStat, variant: VariantStat): SignificanceResult {
  const { zScore, pValue } = twoProportionZTest(
    control.samples,
    control.conversions,
    variant.samples,
    variant.conversions,
  )
  const uplift =
    control.conversionRate > 0
      ? (variant.conversionRate - control.conversionRate) / control.conversionRate
      : 0
  const isSignificant = pValue < 0.05 && variant.samples >= 100
  const isWinner = isSignificant && uplift > 0
  return {
    variantId: variant.variantId,
    variantName: variant.variantName,
    isWinner,
    isSignificant,
    pValue,
    uplift,
    zScore,
    reason: isWinner
      ? `p=${pValue.toFixed(4)} < 0.05 且提升 ${(uplift * 100).toFixed(2)}%`
      : isSignificant
        ? `p=${pValue.toFixed(4)} < 0.05 但无正向提升`
        : `p=${pValue.toFixed(4)} ≥ 0.05 或样本量不足`,
  }
}

/** 评估某实验所有变体的显著性。 */
export async function evaluateTest(testId: string): Promise<{
  testId: string
  results: SignificanceResult[]
  winnerVariantId: string | null
}> {
  const stats = await getTestStats(testId)
  if (stats.length < 2) {
    return { testId, results: [], winnerVariantId: null }
  }
  const control = stats.find((s) => s.isControl)
  if (!control) {
    return { testId, results: [], winnerVariantId: null }
  }

  const results: SignificanceResult[] = []
  let winner: SignificanceResult | null = null
  for (const v of stats) {
    if (v.isControl) continue
    const result = evaluateVariant(control, v)
    results.push(result)
    if (result.isWinner && (!winner || result.uplift > winner.uplift)) {
      winner = result
    }
  }

  return {
    testId,
    results,
    winnerVariantId: winner?.variantId ?? null,
  }
}

/** 评估所有 running 实验并自动推广获胜方案（仅 autoPromote=true 的实验）。 */
export async function evaluateAllRunningTests(): Promise<
  Array<{ testId: string; winner: string | null; promoted: boolean }>
> {
  const running = await db.select().from(abTests).where(eq(abTests.status, 'running'))
  const out: Array<{ testId: string; winner: string | null; promoted: boolean }> = []
  for (const test of running) {
    try {
      const evalResult = await evaluateTest(test.id)
      const shouldPromote = evalResult.winnerVariantId !== null && test.autoPromote
      if (shouldPromote) {
        await endTest(test.id, evalResult.winnerVariantId ?? undefined)
        console.log(`[ab-test-automation] 自动推广 ${test.name} → ${evalResult.winnerVariantId}`)
      }
      out.push({
        testId: test.id,
        winner: evalResult.winnerVariantId,
        promoted: shouldPromote,
      })
    } catch (err) {
      console.error(`[ab-test-automation] evaluate ${test.id} failed:`, (err as Error).message)
      out.push({ testId: test.id, winner: null, promoted: false })
    }
  }
  return out
}

/** 设置实验的 autoPromote 标志。 */
export async function setAutoPromote(testId: string, autoPromote: boolean): Promise<AbTest> {
  const [updated] = await db
    .update(abTests)
    .set({ autoPromote, updatedAt: new Date() })
    .where(eq(abTests.id, testId))
    .returning()
  if (!updated) throw new Error(`实验 ${testId} 不存在`)
  return updated
}
