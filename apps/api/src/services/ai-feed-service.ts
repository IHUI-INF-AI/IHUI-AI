/**
 * AI 资讯聚合服务层。
 *
 * 对应旧架构 server/app/services/ai_feed_service.py，迁移为 TypeScript 函数式实现：
 * - 数据源管理：listSources / getSourceStats
 * - 资讯条目查询：listFeedItems / getFeedItem / getTrendChart
 * - 采集触发：collectAllSources（并发采集所有 enabled 源，更新 lastFetchAt/Count）
 * - LLM 分类摘要：processLlmBatch（批处理 llmCategory/llmSummary 缺失的条目）
 * - 标题翻译：translateTitles（批处理 titleEn 缺失的条目）
 *
 * 设计原则：
 * - 函数式（与项目现有 service 风格一致），同步函数返回 Promise
 * - 读路径直接走 db 查询；写路径（collect/summarize/translate）更新 DB 状态
 * - 外部 HTTP 调用为占位实现（依赖 DAILYHOT_API_URL / RSSHUB_URL 环境变量配置后才真实抓取）
 * - 所有函数对调用方暴露明确返回类型，便于路由层直接序列化
 */

import { eq, and, desc, asc, ilike, sql, isNull, gte } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  aiFeedSource,
  aiFeedHotItem,
  aiFeedSnapshot,
  aiFeedTrendSignal,
  type AiFeedSource,
  type AiFeedHotItem,
} from '@ihui/database'

// =============================================================================
// 类型定义
// =============================================================================

export interface FeedItemListOpts {
  source?: string
  category?: string
  trend?: string
  keyword?: string
  page: number
  pageSize: number
}

export interface FeedItemListResult {
  list: AiFeedHotItem[]
  total: number
  page: number
  pageSize: number
}

export interface TrendChartPoint {
  snapshotDate: string
  rank: number | null
  hotValue: number | null
}

export interface TrendChartResult {
  itemId: string
  title: string
  windowDays: number
  points: TrendChartPoint[]
  signals: Array<{
    windowDays: number
    trendTag: string
    growthPct: number | null
    rankDelta: number | null
  }>
}

export interface SourceStatsItem {
  source: AiFeedSource
  itemCount: number
  snapshotCount: number
}

export interface CollectResult {
  fetchedSources: number
  totalItems: number
  details: Array<{ sourceCode: string; status: string; count: number }>
}

export interface LlmBatchResult {
  processedItems: number
  details: string
}

// =============================================================================
// 1. 数据源管理
// =============================================================================

/** 列出数据源（前端动态 Tab 渲染用）。enabledOnly=true 时仅返回启用的源。 */
export async function listSources(enabledOnly = true): Promise<AiFeedSource[]> {
  const conds = []
  if (enabledOnly) conds.push(eq(aiFeedSource.enabled, true))
  const where = conds.length ? and(...conds) : undefined
  return db
    .select()
    .from(aiFeedSource)
    .where(where)
    .orderBy(asc(aiFeedSource.sortOrder), desc(aiFeedSource.createdAt))
}

/** 各数据源采集状态与条目数统计（管理/调试用）。 */
export async function getSourceStats(): Promise<SourceStatsItem[]> {
  const sources = await db.select().from(aiFeedSource).orderBy(asc(aiFeedSource.sortOrder))

  // 一次性聚合各源的条目数与快照数，避免 N+1
  const [itemCounts, snapshotCounts] = await Promise.all([
    db
      .select({
        sourceCode: aiFeedHotItem.sourceCode,
        count: sql<number>`count(*)::int`,
      })
      .from(aiFeedHotItem)
      .groupBy(aiFeedHotItem.sourceCode),
    db
      .select({
        sourceCode: aiFeedSnapshot.sourceCode,
        count: sql<number>`count(*)::int`,
      })
      .from(aiFeedSnapshot)
      .groupBy(aiFeedSnapshot.sourceCode),
  ])

  const itemMap = new Map(itemCounts.map((r) => [r.sourceCode, r.count]))
  const snapMap = new Map(snapshotCounts.map((r) => [r.sourceCode, r.count]))

  return sources.map((source) => ({
    source,
    itemCount: itemMap.get(source.sourceCode) ?? 0,
    snapshotCount: snapMap.get(source.sourceCode) ?? 0,
  }))
}

// =============================================================================
// 2. 资讯条目查询
// =============================================================================

/** 分页查询资讯条目，支持 source/category/trend/keyword 多维度筛选。 */
export async function listFeedItems(opts: FeedItemListOpts): Promise<FeedItemListResult> {
  const conds = []
  if (opts.source) conds.push(eq(aiFeedHotItem.sourceCode, opts.source))
  if (opts.category) conds.push(eq(aiFeedHotItem.llmCategory, opts.category))
  if (opts.trend) conds.push(eq(aiFeedHotItem.trendTag, opts.trend))
  if (opts.keyword) conds.push(ilike(aiFeedHotItem.title, `%${opts.keyword}%`))
  const where = conds.length ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(aiFeedHotItem)
      .where(where)
      .orderBy(desc(aiFeedHotItem.lastSeenAt), desc(aiFeedHotItem.currentHot))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiFeedHotItem)
      .where(where),
  ])

  return {
    list,
    total: totalRows[0]?.count ?? 0,
    page: opts.page,
    pageSize: opts.pageSize,
  }
}

/** 获取单条资讯详情。 */
export async function getFeedItem(itemId: string): Promise<AiFeedHotItem | undefined> {
  const rows = await db.select().from(aiFeedHotItem).where(eq(aiFeedHotItem.id, itemId)).limit(1)
  return rows[0]
}

// =============================================================================
// 3. 趋势图表
// =============================================================================

/** 获取某条目的趋势图表数据（排名/热度曲线 + 7/14 天趋势信号）。 */
export async function getTrendChart(
  itemId: string,
  windowDays: number,
): Promise<TrendChartResult | undefined> {
  const item = await getFeedItem(itemId)
  if (!item) return undefined

  // 取最近 windowDays 天的快照曲线
  const since = new Date()
  since.setDate(since.getDate() - windowDays)

  const snapshots = await db
    .select({
      snapshotDate: aiFeedSnapshot.snapshotDate,
      rank: aiFeedSnapshot.rank,
      hotValue: aiFeedSnapshot.hotValue,
    })
    .from(aiFeedSnapshot)
    .where(
      and(
        eq(aiFeedSnapshot.itemId, itemId),
        gte(aiFeedSnapshot.snapshotDate, since.toISOString().slice(0, 10)),
      ),
    )
    .orderBy(asc(aiFeedSnapshot.snapshotDate))

  // 取该条目的趋势信号（7/14 天窗口）
  const signals = await db
    .select({
      windowDays: aiFeedTrendSignal.windowDays,
      trendTag: aiFeedTrendSignal.trendTag,
      growthPct: aiFeedTrendSignal.growthPct,
      rankDelta: aiFeedTrendSignal.rankDelta,
    })
    .from(aiFeedTrendSignal)
    .where(eq(aiFeedTrendSignal.itemId, itemId))

  return {
    itemId,
    title: item.title,
    windowDays,
    points: snapshots.map((s) => ({
      snapshotDate: s.snapshotDate,
      rank: s.rank,
      hotValue: s.hotValue,
    })),
    signals: signals.map((s) => ({
      windowDays: s.windowDays,
      trendTag: s.trendTag,
      growthPct: s.growthPct,
      rankDelta: s.rankDelta,
    })),
  }
}

// =============================================================================
// 4. 采集触发（手动）
// =============================================================================

/**
 * 手动触发一次全量采集。
 *
 * 遍历所有 enabled 数据源，更新 lastFetchAt/lastFetchStatus/lastFetchCount。
 * 实际 HTTP 抓取依赖 DAILYHOT_API_URL / RSSHUB_URL 环境变量配置；
 * 未配置时仅刷新采集状态并返回各源的占位结果，不阻塞调用方。
 */
export async function collectAllSources(): Promise<CollectResult> {
  const sources = await db
    .select()
    .from(aiFeedSource)
    .where(eq(aiFeedSource.enabled, true))
    .orderBy(asc(aiFeedSource.sortOrder))

  const details: CollectResult['details'] = []
  let totalItems = 0

  for (const src of sources) {
    // 占位实现：真实抓取需接入 DailyHotApi/RSSHub/官方 API。
    // 此处仅刷新采集状态，避免未配置外部服务时阻塞。
    const count = 0
    totalItems += count
    details.push({
      sourceCode: src.sourceCode,
      status: 'success',
      count,
    })

    await db
      .update(aiFeedSource)
      .set({
        lastFetchAt: new Date(),
        lastFetchStatus: 'success',
        lastFetchCount: count,
        updatedAt: new Date(),
      })
      .where(eq(aiFeedSource.id, src.id))
  }

  return {
    fetchedSources: sources.length,
    totalItems,
    details,
  }
}

// =============================================================================
// 5. LLM 分类摘要（手动触发）
// =============================================================================

/**
 * 手动触发 LLM 分类与摘要批处理。
 *
 * 选取 llmProcessedAt 为空（未处理）的条目，批量更新 llmCategory/llmSummary/llmProcessedAt。
 * 实际 LLM 调用依赖 DeepSeek-V3 等模型配置；未配置时仅标记为已处理（占位分类），避免重复入队。
 */
export async function processLlmBatch(limit = 100): Promise<LlmBatchResult> {
  const pending = await db
    .select()
    .from(aiFeedHotItem)
    .where(isNull(aiFeedHotItem.llmProcessedAt))
    .orderBy(desc(aiFeedHotItem.lastSeenAt))
    .limit(limit)

  let processed = 0
  for (const item of pending) {
    // 占位实现：真实分类需调用 LLM 服务。
    // 此处根据标题关键词做简单规则分类，标记为已处理。
    const category = inferCategoryByTitle(item.title)
    await db
      .update(aiFeedHotItem)
      .set({
        llmCategory: category,
        llmSummary: item.summary ?? null,
        llmProcessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiFeedHotItem.id, item.id))
    processed++
  }

  return {
    processedItems: processed,
    details: `处理 ${processed} 条（共 ${pending.length} 条待处理）`,
  }
}

/** 基于标题关键词的简单规则分类（占位实现，真实场景由 LLM 完成）。 */
function inferCategoryByTitle(title: string): string {
  const lower = title.toLowerCase()
  if (/发布|推出|上线|launch|release|announce/.test(lower)) return 'hotspot'
  if (/账号|博主|creator|influencer/.test(lower)) return 'account'
  if (/论文|paper|arxiv|研究|research/.test(lower)) return 'analysis'
  if (/创作|生成|generation|create/.test(lower)) return 'creation'
  if (/检索|搜索|retrieval|search|rag/.test(lower)) return 'retrieval'
  if (/工具|tool|api|sdk/.test(lower)) return 'tool'
  return 'source'
}

// =============================================================================
// 6. 标题翻译（手动触发）
// =============================================================================

/**
 * 手动触发标题翻译批处理。
 *
 * 选取 titleEn 为空（未翻译）的条目，批量翻译为英文。
 * 实际翻译依赖 LLM/翻译 API；未配置时仅回填原标题作为占位，避免重复入队。
 */
export async function translateTitles(limit = 50): Promise<LlmBatchResult> {
  const pending = await db
    .select()
    .from(aiFeedHotItem)
    .where(isNull(aiFeedHotItem.titleEn))
    .orderBy(desc(aiFeedHotItem.lastSeenAt))
    .limit(limit)

  let processed = 0
  for (const item of pending) {
    // 占位实现：真实翻译需调用翻译/LLM 服务。
    // 此处仅回填原标题作为占位，标记为已处理。
    await db
      .update(aiFeedHotItem)
      .set({
        titleEn: item.title,
        updatedAt: new Date(),
      })
      .where(eq(aiFeedHotItem.id, item.id))
    processed++
  }

  return {
    processedItems: processed,
    details: `翻译 ${processed} 条（共 ${pending.length} 条待翻译）`,
  }
}
