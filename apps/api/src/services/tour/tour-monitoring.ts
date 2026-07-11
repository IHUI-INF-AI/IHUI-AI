/**
 * 旅游内容监控服务。
 *
 * 复用 business-metrics 插件的指标体系（不直接依赖 fastify 实例，
 * 通过注入的 record* 回调解耦，便于单元测试）。
 *
 * 监控维度：
 * - 内容曝光/点击/点赞（counter）
 * - 推荐点击率（histogram）
 * - 灰度阶段分布（gauge）
 * - 错误率（counter）
 */

import { eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { tourContent, tourRecommendations } from '@ihui/database'

export interface TourMetricsSink {
  recordContentImpression(contentId: string): void
  recordContentClick(contentId: string): void
  recordRecommendationCtr(contentId: string, ctr: number): void
  recordGrayStage(stage: string, count: number): void
  recordError(endpoint: string, errorType: string): void
}

/** No-op sink：未注入时使用，避免调用时抛错。 */
export const noopMetricsSink: TourMetricsSink = {
  recordContentImpression: () => {},
  recordContentClick: () => {},
  recordRecommendationCtr: () => {},
  recordGrayStage: () => {},
  recordError: () => {},
}

let sink: TourMetricsSink = noopMetricsSink

/** 注入业务指标 sink（由 routes 层在启动时调用）。 */
export function setMetricsSink(s: TourMetricsSink): void {
  sink = s
}

/** 上报曝光事件。 */
export function trackImpression(contentId: string): void {
  sink.recordContentImpression(contentId)
}

/** 上报点击事件。 */
export function trackClick(contentId: string): void {
  sink.recordContentClick(contentId)
}

/** 上报错误事件。 */
export function trackError(endpoint: string, errorType: string): void {
  sink.recordError(endpoint, errorType)
}

/** 计算并上报推荐点击率。 */
export async function computeAndReportCtr(contentId: string): Promise<number> {
  const [served, clicked] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tourRecommendations)
      .where(eq(tourRecommendations.contentId, contentId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tourRecommendations)
      .where(eq(tourRecommendations.contentId, contentId)),
  ])
  const total = served[0]?.count ?? 0
  const hits = clicked[0]?.count ?? 0
  const ctr = total > 0 ? hits / total : 0
  sink.recordRecommendationCtr(contentId, ctr)
  return ctr
}

/** 上报各灰度阶段的内容数量（应定时调用以刷新 gauge）。 */
export async function reportGrayStageDistribution(): Promise<void> {
  const rows = await db
    .select({
      stage: tourContent.releaseStage,
      count: sql<number>`count(*)::int`,
    })
    .from(tourContent)
    .groupBy(tourContent.releaseStage)
  for (const r of rows) {
    sink.recordGrayStage(r.stage, r.count)
  }
}

/** 单条内容的健康摘要。 */
export interface ContentHealthSummary {
  contentId: string
  viewCount: number
  likeCount: number
  ctr: number
  status: string
  releaseStage: string
}

/** 获取单条内容的健康摘要。 */
export async function getContentHealth(contentId: string): Promise<ContentHealthSummary | null> {
  const [row] = await db.select().from(tourContent).where(eq(tourContent.id, contentId))
  if (!row) return null
  const ctr = await computeAndReportCtr(contentId)
  return {
    contentId: row.id,
    viewCount: row.viewCount,
    likeCount: row.likeCount,
    ctr,
    status: row.status,
    releaseStage: row.releaseStage,
  }
}
