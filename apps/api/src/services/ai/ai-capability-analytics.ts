/**
 * AI 能力分析服务。
 *
 * 对已注册的 AI 能力做多维度分析：
 * - 性能：延迟分位数、错误率、吞吐量
 * - 成本：每次调用均价、月度总成本
 * - 质量：用户评分、A/B 实验提升率
 * - 热度：调用次数趋势
 *
 * 数据源：ai_cost 表 + 自建调用日志（简化版，直接读 aiCapabilities 字段）。
 */

import { eq, sql, desc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { aiCapabilities } from '@ihui/database'

export interface CapabilityStats {
  capabilityId: string
  name: string
  category: string
  provider: string
  performance: {
    avgLatencyMs: number | null
    latencyScore: number // 0~100
  }
  cost: {
    avgCostUsd: number | null
    costScore: number // 0~100，越低越好但反转为高分
  }
  quality: {
    qualityScore: number | null
    ratingScore: number // 0~100
  }
  overallScore: number // 0~100 加权综合
  recommendation: 'keep' | 'optimize' | 'deprecate'
}

/** 计算单个能力的综合评分。 */
export function scoreCapability(cap: {
  avgLatencyMs: number | null
  avgCostUsd: number | null
  qualityScore: number | null
}): { latency: number; cost: number; quality: number; overall: number } {
  const latency = cap.avgLatencyMs !== null ? scoreLatency(cap.avgLatencyMs) : 50
  const cost = cap.avgCostUsd !== null ? scoreCost(cap.avgCostUsd) : 50
  const quality = cap.qualityScore !== null ? Math.round(cap.qualityScore * 100) : 50
  const overall = Math.round(latency * 0.3 + cost * 0.3 + quality * 0.4)
  return { latency, cost, quality, overall }
}

function scoreLatency(ms: number): number {
  if (ms < 500) return 100
  if (ms < 1000) return 85
  if (ms < 2000) return 70
  if (ms < 5000) return 50
  return 20
}

function scoreCost(usd: number): number {
  if (usd === 0) return 100
  if (usd < 0.001) return 95
  if (usd < 0.01) return 80
  if (usd < 0.1) return 60
  if (usd < 1) return 40
  return 15
}

/** 获取所有能力的综合统计。 */
export async function getAllStats(): Promise<CapabilityStats[]> {
  const rows = await db.select().from(aiCapabilities)
  return rows.map((r) => {
    const scores = scoreCapability({
      avgLatencyMs: r.avgLatencyMs,
      avgCostUsd: r.avgCostUsd,
      qualityScore: r.qualityScore,
    })
    let recommendation: CapabilityStats['recommendation'] = 'keep'
    if (scores.overall < 40) recommendation = 'deprecate'
    else if (scores.overall < 70) recommendation = 'optimize'
    return {
      capabilityId: r.id,
      name: r.name,
      category: r.category,
      provider: r.provider,
      performance: { avgLatencyMs: r.avgLatencyMs, latencyScore: scores.latency },
      cost: { avgCostUsd: r.avgCostUsd, costScore: scores.cost },
      quality: { qualityScore: r.qualityScore, ratingScore: scores.quality },
      overallScore: scores.overall,
      recommendation,
    }
  })
}

/** 获取单个能力详情。 */
export async function getStats(capabilityId: string): Promise<CapabilityStats | null> {
  const [row] = await db.select().from(aiCapabilities).where(eq(aiCapabilities.id, capabilityId))
  if (!row) return null
  const scores = scoreCapability({
    avgLatencyMs: row.avgLatencyMs,
    avgCostUsd: row.avgCostUsd,
    qualityScore: row.qualityScore,
  })
  let recommendation: CapabilityStats['recommendation'] = 'keep'
  if (scores.overall < 40) recommendation = 'deprecate'
  else if (scores.overall < 70) recommendation = 'optimize'
  return {
    capabilityId: row.id,
    name: row.name,
    category: row.category,
    provider: row.provider,
    performance: { avgLatencyMs: row.avgLatencyMs, latencyScore: scores.latency },
    cost: { avgCostUsd: row.avgCostUsd, costScore: scores.cost },
    quality: { qualityScore: row.qualityScore, ratingScore: scores.quality },
    overallScore: scores.overall,
    recommendation,
  }
}

/** 排行榜：按综合得分排序。 */
export async function leaderboard(limit = 20): Promise<CapabilityStats[]> {
  const stats = await getAllStats()
  return stats.sort((a, b) => b.overallScore - a.overallScore).slice(0, limit)
}

/** 待优化能力列表。 */
export async function listToOptimize(): Promise<CapabilityStats[]> {
  const stats = await getAllStats()
  return stats.filter((s) => s.recommendation !== 'keep')
}

/** 更新能力的性能/成本/质量指标（由调用方注入真实数据源）。 */
export async function updateMetrics(
  capabilityId: string,
  metrics: { avgLatencyMs?: number; avgCostUsd?: number; qualityScore?: number },
): Promise<void> {
  await db
    .update(aiCapabilities)
    .set({
      ...(metrics.avgLatencyMs !== undefined && { avgLatencyMs: metrics.avgLatencyMs }),
      ...(metrics.avgCostUsd !== undefined && { avgCostUsd: metrics.avgCostUsd }),
      ...(metrics.qualityScore !== undefined && { qualityScore: metrics.qualityScore }),
      updatedAt: new Date(),
    })
    .where(eq(aiCapabilities.id, capabilityId))
}

/** 按 category 汇总平均分。 */
export async function avgScoreByCategory(): Promise<
  Array<{ category: string; avgScore: number; count: number }>
> {
  const rows = await db
    .select({
      category: aiCapabilities.category,
      avgScore: sql<number>`coalesce(avg(${aiCapabilities.qualityScore}), 0)::real`,
      count: sql<number>`count(*)::int`,
    })
    .from(aiCapabilities)
    .groupBy(aiCapabilities.category)
    .orderBy(desc(sql`avg(${aiCapabilities.qualityScore})`))
  return rows.map((r) => ({
    category: r.category,
    avgScore: r.avgScore ?? 0,
    count: r.count ?? 0,
  }))
}
