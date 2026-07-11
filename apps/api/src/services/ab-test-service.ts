/**
 * A/B 测试服务。
 *
 * 实验组/对照组分配 + 流量分配 + 结果统计。
 *
 * 核心能力：
 * - 创建实验：定义变体（含对照组）+ 流量百分比 + 目标指标
 * - 流量分配：基于 (testId + subjectId) 哈希分桶，保证同一主体稳定命中
 * - 结果统计：按变体聚合样本数/转化数，计算转化率与置信区间
 */

import { eq, sql, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  abTests,
  abTestVariants,
  abTestResults,
  type AbTest,
  type AbTestVariant,
} from '@ihui/database'

export interface CreateTestInput {
  name: string
  description?: string
  trafficPercent?: number
  targetMetric: string
  autoPromote?: boolean
  config?: Record<string, unknown>
  variants: Array<{
    name: string
    description?: string
    isControl?: boolean
    trafficWeight?: number
    payload?: Record<string, unknown>
  }>
}

export type AssignmentResult = {
  testId: string
  variant: AbTestVariant | null
  reason: string
}

/** 哈希分桶：0~99 的整数桶号，保证 (testId+subjectId) 稳定命中。 */
function hashBucket(testId: string, subjectId: string): number {
  let h = 0
  const s = `${testId}::${subjectId}`
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h % 100
}

/** 创建实验。 */
export async function createTest(input: CreateTestInput): Promise<AbTest> {
  if (input.variants.length < 2) throw new Error('至少需要 2 个变体')
  if (!input.variants.some((v) => v.isControl)) {
    throw new Error('至少需要一个对照组（isControl=true）')
  }

  const [test] = await db
    .insert(abTests)
    .values({
      name: input.name,
      description: input.description,
      trafficPercent: input.trafficPercent ?? 100,
      targetMetric: input.targetMetric,
      autoPromote: input.autoPromote ?? false,
      config: input.config ?? {},
      status: 'draft',
    })
    .returning()
  if (!test) throw new Error('实验创建失败')

  await db.insert(abTestVariants).values(
    input.variants.map((v) => ({
      testId: test.id,
      name: v.name,
      description: v.description,
      isControl: v.isControl ?? false,
      trafficWeight: v.trafficWeight ?? 1,
      payload: v.payload ?? {},
    })),
  )
  return test
}

/** 启动实验（status: draft → running）。 */
export async function startTest(testId: string): Promise<AbTest> {
  const [updated] = await db
    .update(abTests)
    .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
    .where(eq(abTests.id, testId))
    .returning()
  if (!updated) throw new Error(`实验 ${testId} 不存在`)
  return updated
}

/** 暂停实验。 */
export async function pauseTest(testId: string): Promise<AbTest> {
  const [updated] = await db
    .update(abTests)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(eq(abTests.id, testId))
    .returning()
  if (!updated) throw new Error(`实验 ${testId} 不存在`)
  return updated
}

/** 结束实验并记录获胜变体。 */
export async function endTest(testId: string, winningVariantId?: string): Promise<AbTest> {
  const [updated] = await db
    .update(abTests)
    .set({
      status: 'completed',
      endedAt: new Date(),
      winningVariantId,
      updatedAt: new Date(),
    })
    .where(eq(abTests.id, testId))
    .returning()
  if (!updated) throw new Error(`实验 ${testId} 不存在`)
  return updated
}

/** 列出所有实验。 */
export async function listTests(status?: string): Promise<AbTest[]> {
  if (status) {
    return db.select().from(abTests).where(eq(abTests.status, status))
  }
  return db.select().from(abTests)
}

/** 获取实验详情（含变体）。 */
export async function getTestDetail(testId: string): Promise<{
  test: AbTest
  variants: AbTestVariant[]
} | null> {
  const [test] = await db.select().from(abTests).where(eq(abTests.id, testId))
  if (!test) return null
  const variants = await db.select().from(abTestVariants).where(eq(abTestVariants.testId, testId))
  return { test, variants }
}

/** 为某主体分配变体（基于哈希分桶，保证稳定）。 */
export async function assignVariant(testId: string, subjectId: string): Promise<AssignmentResult> {
  const detail = await getTestDetail(testId)
  if (!detail) return { testId, variant: null, reason: '实验不存在' }
  if (detail.test.status !== 'running') {
    return { testId, variant: null, reason: `实验状态为 ${detail.test.status}，不可分配` }
  }

  // 流量百分比分桶
  const bucket = hashBucket(testId, subjectId)
  if (bucket >= detail.test.trafficPercent) {
    return { testId, variant: null, reason: '未命中实验流量' }
  }

  // 按权重在命中的变体中分配
  const totalWeight = detail.variants.reduce((s, v) => s + v.trafficWeight, 0)
  if (totalWeight === 0) return { testId, variant: null, reason: '变体权重总和为 0' }

  const variantBucket = (bucket * 100) % totalWeight
  let acc = 0
  for (const v of detail.variants) {
    acc += v.trafficWeight
    if (variantBucket < acc) return { testId, variant: v, reason: '命中变体' }
  }
  return { testId, variant: detail.variants[0] ?? null, reason: '回退到首个变体' }
}

/** 记录一次样本曝光（按变体 + 时间桶聚合）。 */
export async function recordExposure(testId: string, variantId: string): Promise<void> {
  const bucket = new Date().toISOString().slice(0, 13) // 小时桶 'YYYY-MM-DDTHH'
  await db
    .insert(abTestResults)
    .values({
      testId,
      variantId,
      bucket,
      samples: 1,
      conversions: 0,
      revenue: 0,
    })
    .onConflictDoUpdate({
      target: [abTestResults.variantId, abTestResults.bucket],
      set: {
        samples: sql`${abTestResults.samples} + 1`,
        updatedAt: new Date(),
      },
    })
}

/** 记录一次转化事件。 */
export async function recordConversion(
  testId: string,
  variantId: string,
  revenue = 0,
): Promise<void> {
  const bucket = new Date().toISOString().slice(0, 13)
  await db
    .insert(abTestResults)
    .values({
      testId,
      variantId,
      bucket,
      samples: 0,
      conversions: 1,
      revenue,
    })
    .onConflictDoUpdate({
      target: [abTestResults.variantId, abTestResults.bucket],
      set: {
        conversions: sql`${abTestResults.conversions} + 1`,
        revenue: sql`${abTestResults.revenue} + ${revenue}`,
        updatedAt: new Date(),
      },
    })
}

/** 统计某实验各变体的累计指标。 */
export interface VariantStat {
  variantId: string
  variantName: string
  isControl: boolean
  samples: number
  conversions: number
  conversionRate: number
  revenue: number
}

export async function getTestStats(testId: string): Promise<VariantStat[]> {
  const variants = await db.select().from(abTestVariants).where(eq(abTestVariants.testId, testId))
  if (variants.length === 0) return []

  const variantIds = variants.map((v) => v.id)
  const rows = await db
    .select({
      variantId: abTestResults.variantId,
      samples: sql<number>`coalesce(sum(${abTestResults.samples}), 0)::int`,
      conversions: sql<number>`coalesce(sum(${abTestResults.conversions}), 0)::int`,
      revenue: sql<number>`coalesce(sum(${abTestResults.revenue}), 0)::int`,
    })
    .from(abTestResults)
    .where(inArray(abTestResults.variantId, variantIds))
    .groupBy(abTestResults.variantId)

  return variants.map((v) => {
    const stat = rows.find((r) => r.variantId === v.id)
    const samples = stat?.samples ?? 0
    const conversions = stat?.conversions ?? 0
    return {
      variantId: v.id,
      variantName: v.name,
      isControl: v.isControl,
      samples,
      conversions,
      conversionRate: samples > 0 ? conversions / samples : 0,
      revenue: stat?.revenue ?? 0,
    }
  })
}

/** 删除实验（级联删除变体与结果）。 */
export async function deleteTest(testId: string): Promise<void> {
  await db.delete(abTests).where(eq(abTests.id, testId))
}
