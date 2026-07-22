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
 * - 外部 HTTP 抓取依赖 DAILYHOT_API_URL / RSSHUB_URL 环境变量配置
 * - LLM 调用依赖 AI_SERVICE_URL 环境变量配置，未配置时回退到关键词规则
 * - 所有函数对调用方暴露明确返回类型，便于路由层直接序列化
 */

import { env } from 'node:process'
import { eq, and, desc, asc, ilike, sql, isNull, gte } from 'drizzle-orm'
import Parser from 'rss-parser'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import {
  aiFeedSource,
  aiFeedHotItem,
  aiFeedSnapshot,
  aiFeedTrendSignal,
  type AiFeedSource,
  type AiFeedHotItem,
} from '@ihui/database'

/** rss-parser 单例(避免每次请求重建实例,解析 RSS/Atom XML) */
const rssParser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'IHUI-AI-Feed/1.0 (+https://ihui.ai)' },
})

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

interface FetchedFeedItem {
  sourceCode: string
  platformItemId: string
  title: string
  summary?: string | null
  url?: string | null
  coverUrl?: string | null
  author?: string | null
  currentRank?: number | null
  currentHot?: number | null
  publishTime?: Date | null
}

// =============================================================================
// 内部工具：HTTP 抓取 + LLM 调用
// =============================================================================

const FETCH_TIMEOUT_MS = 10_000

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function parseHotValue(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return raw
  const str = String(raw).trim()
  if (!str) return null
  const match = str.match(/^([\d.]+)\s*(亿|万|千)?/)
  if (!match || !match[1]) return null
  let num = parseFloat(match[1] ?? '0')
  if (Number.isNaN(num)) return null
  const unit = match[2]
  if (unit === '亿') num *= 100_000_000
  else if (unit === '万') num *= 10_000
  else if (unit === '千') num *= 1_000
  return Math.round(num)
}

async function fetchDailyHotApi(url: string, sourceCode: string): Promise<FetchedFeedItem[]> {
  const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`DailyHotApi ${url} 返回 ${res.status}`)
  const json = (await res.json()) as {
    code?: number
    data?: Array<Record<string, unknown>>
    items?: Array<Record<string, unknown>>
  }
  const list = json.data ?? json.items ?? []
  return list.map((raw, idx) => ({
    sourceCode,
    platformItemId: String(raw.id ?? raw._id ?? idx),
    title: String(raw.title ?? '').slice(0, 500),
    summary: raw.desc ? String(raw.desc).slice(0, 2000) : null,
    url: raw.url ? String(raw.url) : raw.mobileUrl ? String(raw.mobileUrl) : null,
    coverUrl: raw.cover ? String(raw.cover) : raw.thumbnail ? String(raw.thumbnail) : null,
    author: raw.author
      ? String(raw.author).slice(0, 200)
      : raw.source
        ? String(raw.source).slice(0, 200)
        : null,
    currentRank: idx + 1,
    currentHot: parseHotValue(raw.hot),
    publishTime: raw.pubDate ? new Date(String(raw.pubDate)) : null,
  }))
}

async function fetchRssHub(url: string, sourceCode: string): Promise<FetchedFeedItem[]> {
  const target = url.includes('?') ? `${url}&format=json` : `${url}?format=json`
  const res = await fetchWithTimeout(target, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`RSSHub ${url} 返回 ${res.status}`)
  const json = (await res.json()) as {
    items?: Array<Record<string, unknown>>
    data?: Array<Record<string, unknown>>
  }
  const list = json.items ?? json.data ?? []
  return list.map((raw, idx) => ({
    sourceCode,
    platformItemId: String(raw.id ?? raw.guid ?? idx).slice(0, 128),
    title: String(raw.title ?? '').slice(0, 500),
    summary: raw.description ? String(raw.description).slice(0, 2000) : null,
    url: raw.link ? String(raw.link) : raw.url ? String(raw.url) : null,
    coverUrl: raw.enclosure ? String(raw.enclosure) : null,
    author: raw.author ? String(raw.author).slice(0, 200) : null,
    currentRank: idx + 1,
    currentHot: null,
    publishTime: raw.pubDate ? new Date(String(raw.pubDate)) : null,
  }))
}

/**
 * 安全转 string:处理 rss-parser 返回的 object 类型 guid/link(Atom feed 非标准格式)。
 * Atom feed 的 guid 可能是 { isPermaLink: false, value: "xxx" } 这样的对象,
 * 直接 String() 会报 "Cannot convert object to primitive value"。
 */
function toSafeStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    if (typeof obj.value === 'string') return obj.value
    if (typeof obj._ === 'string') return obj._
    try {
      return JSON.stringify(v)
    } catch {
      return ''
    }
  }
  try {
    return String(v)
  } catch {
    return ''
  }
}

/**
 * 原生 RSS/Atom XML 解析(用于厂商博客/媒体原生 RSS feed,不依赖 RSSHub)。
 *
 * 与 fetchRssHub 的区别:
 * - fetchRssHub 拉 RSSHub 的 JSON 接口(相对路径,拼接 rsshubUrl)
 * - fetchRssXml 直接拉取原生 RSS/Atom XML(完整 URL,如 https://export.arxiv.org/rss/cs.AI)
 *
 * 用 rss-parser 解析,支持 RSS 2.0 / Atom 1.0 / RDF 等格式。
 */
async function fetchRssXml(url: string, sourceCode: string): Promise<FetchedFeedItem[]> {
  const res = await fetchWithTimeout(url, {
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      'User-Agent': 'IHUI-AI-Feed/1.0 (+https://ihui.ai)',
    },
  })
  if (!res.ok) throw new Error(`RSS XML ${url} 返回 ${res.status}`)
  const xml = await res.text()
  const feed = await rssParser.parseString(xml)
  return (feed.items ?? []).map((item, idx) => ({
    sourceCode,
    platformItemId: toSafeStr(item.guid ?? item.link ?? idx).slice(0, 128),
    title: toSafeStr(item.title).slice(0, 500),
    summary: toSafeStr(item.contentSnippet ?? item.content).slice(0, 2000) || null,
    url: toSafeStr(item.link) || null,
    coverUrl: item.enclosure?.url ? toSafeStr(item.enclosure.url) : null,
    author: toSafeStr(item.creator ?? item.author).slice(0, 200) || null,
    currentRank: idx + 1,
    currentHot: null,
    publishTime: item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null,
  }))
}

async function callLlm(
  prompt: string,
  content: string,
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const baseUrl = env.AI_SERVICE_URL
  if (!baseUrl) return null
  try {
    // LLM 调用单独用 90 秒超时(StepFun step-3.7-flash 推理模型 ~25s/条,
    // fetchWithTimeout 的 10s 对 LLM 不够,需独立更长超时)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90_000)
    try {
      const body: Record<string, unknown> = {
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content },
        ],
      }
      // max_tokens 限制输出长度(分类任务只需 ~20 token,防止 LLM 生成 HTML/长文)
      if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens
      // temperature=0 确定性输出(分类任务不需要创造性)
      if (options.temperature !== undefined) body.temperature = options.temperature
      const res = await aiServiceFetch(null, '/api/llm/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        logger.warn(`LLM 调用失败 status=${res.status}`, { url: `${baseUrl}/api/llm/complete` })
        return null
      }
    // ai-service /llm/complete 返回 {content, model, usage, stub, error?, error_message?}
    const json = (await res.json()) as {
      content?: string
      error?: boolean
      error_message?: string
      stub?: boolean
    }
    if (json.error) {
      logger.warn(`LLM 调用返回错误: ${json.error_message ?? 'unknown'}`)
      return null
    }
    if (json.stub) {
      logger.warn(`LLM stub 模式返回(无真实 API key),跳过`)
      return null
    }
    const text = json.content ?? ''
    return text.trim() || null
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    logger.warn(`LLM 调用异常: ${(e as Error).message}`)
    return null
  }
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
 * 遍历所有 enabled 数据源，根据 sourceType 调用对应抓取器：
 * - hotlist: DAILYHOT_API_URL（默认路径 /news）
 * - rss: RSSHUB_URL（默认路径 /热门订阅）
 * - api: 使用 source.endpoint 直接抓取
 * 数据源 endpoint 字段优先于默认路径。
 * 未配置对应环境变量时刷新采集状态并返回各源 skipped 结果，不阻塞调用方。
 */
export async function collectAllSources(): Promise<CollectResult> {
  const sources = await db
    .select()
    .from(aiFeedSource)
    .where(eq(aiFeedSource.enabled, true))
    .orderBy(asc(aiFeedSource.sortOrder))

  const dailyHotUrl = env.DAILYHOT_API_URL
  const rsshubUrl = env.RSSHUB_URL

  const details: CollectResult['details'] = []
  let totalItems = 0

  // 两个抓取源都未配置：降级
  if (!dailyHotUrl && !rsshubUrl) {
    logger.warn('collectAllSources: DAILYHOT_API_URL 与 RSSHUB_URL 均未配置,采集降级为空')
    for (const src of sources) {
      details.push({ sourceCode: src.sourceCode, status: 'skipped', count: 0 })
      await db
        .update(aiFeedSource)
        .set({
          lastFetchAt: new Date(),
          lastFetchStatus: 'skipped',
          lastFetchCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(aiFeedSource.id, src.id))
    }
    return { fetchedSources: sources.length, totalItems: 0, details }
  }

  for (const src of sources) {
    let items: FetchedFeedItem[] = []
    let status = 'success'

    try {
      if (src.sourceType === 'hotlist' && dailyHotUrl) {
        // endpoint 智能拼接:
        // - 完整 URL(http(s)://开头)直接用
        // - 相对路径(如 /news/weibo)拼接到 dailyHotUrl
        // - null/undefined 走默认 ${dailyHotUrl}/news
        const url = src.endpoint
          ? src.endpoint.startsWith('http')
            ? src.endpoint
            : new URL(src.endpoint, dailyHotUrl).toString()
          : `${dailyHotUrl}/news`
        items = await fetchDailyHotApi(url, src.sourceCode)
      } else if (src.sourceType === 'rss') {
        // RSS 分支:优先用原生 RSS feed(完整 URL 且非 rsshub.app),否则走 RSSHub
        if (
          src.endpoint &&
          src.endpoint.startsWith('http') &&
          !src.endpoint.includes('rsshub.app')
        ) {
          // 原生 RSS/Atom XML(如 https://export.arxiv.org/rss/cs.AI)
          items = await fetchRssXml(src.endpoint, src.sourceCode)
        } else if (rsshubUrl) {
          // RSSHub 相对路径(如 /openai/blog),拼接 rsshubUrl 后走 JSON 接口
          const url = src.endpoint
            ? src.endpoint.startsWith('http')
              ? src.endpoint
              : new URL(src.endpoint, rsshubUrl).toString()
            : `${rsshubUrl}/热门订阅`
          items = await fetchRssHub(url, src.sourceCode)
        } else {
          // 既不是原生 RSS,也未配 rsshubUrl,跳过
          details.push({ sourceCode: src.sourceCode, status: 'skipped', count: 0 })
          await db
            .update(aiFeedSource)
            .set({
              lastFetchAt: new Date(),
              lastFetchStatus: 'skipped',
              lastFetchCount: 0,
              updatedAt: new Date(),
            })
            .where(eq(aiFeedSource.id, src.id))
          continue
        }
      } else if (src.sourceType === 'api' && src.endpoint) {
        // api 类型直接用 endpoint，优先尝试 DailyHotApi 格式
        items = await fetchDailyHotApi(src.endpoint, src.sourceCode)
      } else {
        // sourceType 与已配置环境变量不匹配，跳过
        details.push({ sourceCode: src.sourceCode, status: 'skipped', count: 0 })
        await db
          .update(aiFeedSource)
          .set({
            lastFetchAt: new Date(),
            lastFetchStatus: 'skipped',
            lastFetchCount: 0,
            updatedAt: new Date(),
          })
          .where(eq(aiFeedSource.id, src.id))
        continue
      }
    } catch (e) {
      status = 'error'
      logger.warn(`collectAllSources: 采集 ${src.sourceCode} 失败: ${(e as Error).message}`)
    }

    // 幂等 upsert：已存在的 (sourceCode, platformItemId) 更新 lastSeenAt/currentHot/currentRank
    for (const item of items) {
      await db
        .insert(aiFeedHotItem)
        .values({
          sourceCode: item.sourceCode,
          platformItemId: item.platformItemId,
          title: item.title,
          summary: item.summary ?? null,
          url: item.url ?? null,
          coverUrl: item.coverUrl ?? null,
          author: item.author ?? null,
          currentRank: item.currentRank ?? null,
          currentHot: item.currentHot ?? null,
          publishTime: item.publishTime ?? null,
          lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [aiFeedHotItem.sourceCode, aiFeedHotItem.platformItemId],
          set: {
            title: item.title,
            summary: item.summary ?? sql`null`,
            url: item.url ?? sql`null`,
            coverUrl: item.coverUrl ?? sql`null`,
            author: item.author ?? sql`null`,
            currentRank: item.currentRank ?? sql`null`,
            currentHot: item.currentHot ?? sql`null`,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        })
    }

    totalItems += items.length
    details.push({ sourceCode: src.sourceCode, status, count: items.length })

    await db
      .update(aiFeedSource)
      .set({
        lastFetchAt: new Date(),
        lastFetchStatus: status,
        lastFetchCount: items.length,
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

const CATEGORY_PROMPT = `你是 AI 资讯分类器。只返回一个类别名,不要任何其他内容(不要解释、不要 HTML、不要 markdown、不要标点)。

类别:
- ai-models:AI 模型发布/升级/评测(GPT/Claude/Gemini/Llama/Qwen 等模型本身)
- ai-products:AI 产品/应用/工具/GitHub 项目/Agent 平台
- industry:行业动态/融资/收购/政策/市场/非 AI 科技新闻
- paper:学术论文/arXiv/研究
- tip:技巧/教程/how-to/最佳实践

规则:
1. 信源 arxiv* → paper
2. 信源 github-trending → ai-products(除非仓库名含 model/llm → ai-models)
3. 非 AI 主题 → industry
4. 模糊 → industry

示例:
信源: arxiv-cs-ai
标题: Attention Is All You Need
paper

信源: github-trending
标题: microsoft/Ontology-Playground
ai-products

信源: hackernews
标题: OpenAI 发布 GPT-5
ai-models

信源: techcrunch-ai
标题: Anthropic 完成 10 亿美元融资
industry

只返回一个类别名。`

/**
 * 手动触发 LLM 分类与摘要批处理。
 *
 * 选取 llmProcessedAt 为空（未处理）的条目，批量更新 llmCategory/llmSummary/llmProcessedAt。
 * 配置 AI_SERVICE_URL 时调用 LLM 服务做分类；未配置或调用失败时回退到关键词规则。
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
    // 优先调用 LLM 做分类，失败回退到关键词规则
    let category: string
    // 把 sourceCode 拼到 content 里,让 LLM 看到信源信息以便正确分类(arxiv→paper 等)
    const llmContent = `信源: ${item.sourceCode}\n标题: ${item.title}`
    // 不传 max_tokens:StepFun step-3.7-flash 是推理模型,reasoning 字段会消耗大量 token
    // (实测 ~760 token),限制 max_tokens=20/200 会导致 reasoning 未完成 content 为空。
    // 不限制时,content 是 markdown 文档(含 "### Classification result: paper" 等),
    // 由 extractCategory 正则提取类别名。
    // temperature=0 确定性输出
    const llmResult = await callLlm(CATEGORY_PROMPT, llmContent, {
      temperature: 0,
    })
    // 后处理:先尝试正则提取(防御 LLM 输出非类别内容,如被 markdown 包裹)
    const extracted = llmResult ? extractCategory(llmResult) : null
    if (extracted) {
      category = extracted
    } else if (llmResult && isValidCategory(llmResult)) {
      category = llmResult.toLowerCase()
    } else {
      category = inferCategoryByTitle(item.title, item.sourceCode)
    }

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

const VALID_CATEGORIES = new Set(['ai-models', 'ai-products', 'industry', 'paper', 'tip'])

function isValidCategory(value: string): boolean {
  return VALID_CATEGORIES.has(value.trim().toLowerCase())
}

/**
 * 从 LLM 输出中提取类别名(正则匹配,防御 LLM 输出非类别内容)。
 *
 * 即使 LLM 返回 markdown 包裹(如 "paper" 或 "类别: paper")或被 HTML 包裹,
 * 也能提取到第一个匹配的类别名。匹配不到返回 null。
 */
function extractCategory(llmOutput: string): string | null {
  const match = llmOutput.match(/\b(ai-models|ai-products|industry|paper|tip)\b/i)
  return match?.[1]?.toLowerCase() ?? null
}

/** 基于标题关键词的简单规则分类（LLM 不可用时的降级实现）。与 aihot 6 类对齐(5 类 + 默认)。 */
function inferCategoryByTitle(title: string, sourceCode?: string): string {
  // 信源级判断:arxiv 信源的条目天然是学术论文
  if (sourceCode && sourceCode.startsWith('arxiv')) return 'paper'
  const lower = title.toLowerCase()
  // paper 必须先判断,避免被 ai-models 关键词截胡(很多论文标题含"模型")
  if (/论文|paper|arxiv|research|研究|emnlp|neurips|icml|iclr|cvpr/.test(lower)) return 'paper'
  if (/融资|收购|ipo|funding|acquisition|市场|行业|政策|监管|ipo|上市/.test(lower))
    return 'industry'
  if (/教程|技巧|实践|guide|tutorial|tip|best practice|最佳实践|how-to|入门/.test(lower))
    return 'tip'
  if (
    /产品|应用|上线|product|app|platform|chatgpt|cursor|copilot|agent|智能体|机器人|机器人|平台|workspace|服务/.test(
      lower,
    )
  )
    return 'ai-products'
  // 默认 ai-models:覆盖模型发布/升级/评测,本任务 41 信源中一手厂商博客多数属此类
  if (
    /发布|推出|升级|launch|release|announce|gpt|claude|gemini|llama|mistral|qwen|deepseek|kimi|moonshot|glm|混元|hunyuan|模型|llm|foundation model|vlm|多模态|推理|reasoning/.test(
      lower,
    )
  )
    return 'ai-models'
  return 'ai-models'
}

// =============================================================================
// 6. 标题翻译（手动触发）
// =============================================================================

const TRANSLATE_PROMPT = '将以下中文标题翻译为英文，仅返回翻译结果，不要添加任何解释或引号。'

/**
 * 手动触发标题翻译批处理。
 *
 * 选取 titleEn 为空（未翻译）的条目，批量翻译为英文。
 * 配置 AI_SERVICE_URL 时调用 LLM 做翻译；未配置或调用失败时回填原标题作为占位。
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
    // 优先调用 LLM 做翻译，失败回填原标题作为占位
    let titleEn: string
    try {
      const llmResult = await callLlm(TRANSLATE_PROMPT, item.title)
      titleEn = llmResult && llmResult.length > 0 ? llmResult.slice(0, 500) : item.title
    } catch (e) {
      logger.warn(`translateTitles: 翻译 ${item.id} 失败: ${(e as Error).message}`)
      titleEn = item.title
    }

    await db
      .update(aiFeedHotItem)
      .set({
        titleEn,
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

// =============================================================================
// 7. 趋势爆发通知（轮询用）
// =============================================================================

export interface TrendNotificationItem {
  id: string
  title: string
  url: string | null
  coverUrl: string | null
  sourceCode: string
  currentHot: number | null
  currentRank: number | null
  trendTag: string | null
  trendGrowthPct: number | null
  lastSeenAt: Date
}

/**
 * 查询近期 trendTag=rising 且 trendGrowthPct >= minGrowth 的条目。
 *
 * 前端每 60 秒轮询一次此端点，有新条目时通过 ElNotification 推送。
 * 替代 socket.io 的轻量实时推送方案（与旧架构 server/app/api/v1/ai_feed/routes.py 一致）。
 */
export async function getTrendNotifications(
  hours: number,
  minGrowth: number,
  limit: number,
): Promise<{ list: TrendNotificationItem[]; total: number }> {
  const since = new Date()
  since.setHours(since.getHours() - hours)

  const list = await db
    .select({
      id: aiFeedHotItem.id,
      title: aiFeedHotItem.title,
      url: aiFeedHotItem.url,
      coverUrl: aiFeedHotItem.coverUrl,
      sourceCode: aiFeedHotItem.sourceCode,
      currentHot: aiFeedHotItem.currentHot,
      currentRank: aiFeedHotItem.currentRank,
      trendTag: aiFeedHotItem.trendTag,
      trendGrowthPct: aiFeedHotItem.trendGrowthPct,
      lastSeenAt: aiFeedHotItem.lastSeenAt,
    })
    .from(aiFeedHotItem)
    .where(
      and(
        eq(aiFeedHotItem.trendTag, 'rising'),
        gte(aiFeedHotItem.trendGrowthPct, minGrowth),
        gte(aiFeedHotItem.lastSeenAt, since),
      ),
    )
    .orderBy(desc(aiFeedHotItem.trendGrowthPct))
    .limit(limit)

  return { list, total: list.length }
}

// =============================================================================
// 8. 图片代理（防盗链）
// =============================================================================

/**
 * 代理图片请求，绕过 Referer 防盗链，返回图片二进制 + Content-Type。
 *
 * 用于前端 <img> 标签的 src，避免 403 Forbidden。
 * 与旧架构 server/app/api/v1/ai_feed/routes.py 的 image_proxy 一致。
 *
 * 安全防护(2026-07-21 安全审计加固):
 * - 拒绝内网 / loopback / link-local / 私有 IP 段(SSRF 防护)
 * - 域名白名单(只允许已知图床域名)
 * - 端口白名单(只允许 80/443)
 * - 响应体大小限制(防止内存耗尽)
 * - Content-Type 白名单(只允许 image/*)
 */
const ALLOWED_IMAGE_HOSTNAMES = new Set([
  'aizhs.top',
  'www.aizhs.top',
  'api.dicebear.com',
  'lh3.googleusercontent.com',
  'avatars.githubusercontent.com',
  'platform-lookaside.fbsbx.com',
  // 第三方资讯源常用图床
  'p3-search.byteimg.com',
  'p1-search.byteimg.com',
  'p6-search.byteimg.com',
  'img.zcool.cn',
  'pic.imgdb.cn',
  'image-cdn.huxiucdn.com',
  'nimg.ws.126.net',
  'img1.doubanio.com',
  'img2.doubanio.com',
  'img3.doubanio.com',
  'wx1.sinaimg.cn',
  'wx2.sinaimg.cn',
  'wx3.sinaimg.cn',
  'wx4.sinaimg.cn',
  'n.sinaimg.cn',
])

/** 私有/内网/loopback/link-local IP 检测(Node 的 net.isIP 解析后判定) */
function isPrivateOrReservedIp(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  // IPv4 字符串直接判定
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) {
    const parts = lower.split('.').map(Number)
    if (parts.length !== 4 || parts.some((p) => p < 0 || p > 255)) return true
    const [a, b] = parts as [number, number, number, number]
    // 0.0.0.0/8
    if (a === 0) return true
    // 10.0.0.0/8
    if (a === 10) return true
    // 127.0.0.0/8 loopback
    if (a === 127) return true
    // 169.254.0.0/16 link-local(含云元数据 169.254.169.254)
    if (a === 169 && b === 254) return true
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true
    // 100.64.0.0/10 CGN
    if (a === 100 && b >= 64 && b <= 127) return true
    // 224.0.0.0/4 multicast
    if (a >= 224 && a <= 239) return true
    return false
  }
  // IPv6 简化判定
  if (lower.includes(':')) {
    // ::1 loopback / :: unspecified / fc00::/7 unique-local / fe80::/10 link-local
    if (lower === '::1' || lower === '::') return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
    if (
      lower.startsWith('fe80:') ||
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    )
      return true
    return false
  }
  // 主机名形式:localhost + 常见内部域名
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true
  }
  return false
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024 // 20MB 上限

export async function proxyImage(url: string): Promise<{
  buffer: Buffer
  contentType: string
}> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('无效的图片 URL')
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('无效的图片 URL')
  }
  // 1) 协议白名单(http/https)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅支持 http/https 协议')
  }
  // 2) 端口白名单(默认 80/443 + 显式 80/443)
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80
  if (port !== 80 && port !== 443) {
    throw new Error('仅支持 80/443 端口')
  }
  // 3) 私有/内网 IP 阻断(防 SSRF)
  if (isPrivateOrReservedIp(parsed.hostname)) {
    throw new Error('禁止访问内网/私有 IP')
  }
  // 4) 域名白名单(只放行已知图床;若要支持自定义,需在 ALLOWED_IMAGE_HOSTNAMES 添加)
  const host = parsed.hostname.toLowerCase()
  if (!ALLOWED_IMAGE_HOSTNAMES.has(host) && !host.endsWith('.aizhs.top')) {
    throw new Error('域名不在图片代理白名单中')
  }
  const referer = `${parsed.protocol}//${parsed.host}`
  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: referer,
    },
  })
  if (!res.ok) throw new Error(`图片获取失败: HTTP ${res.status}`)
  // 5) Content-Type 白名单
  const contentType = res.headers.get('content-type') ?? ''
  if (!/^image\//i.test(contentType)) {
    throw new Error('响应内容不是图片')
  }
  // 6) 响应体大小限制(防止 OOM / 慢攻击)
  const contentLength = res.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) {
    throw new Error(`图片过大(>${MAX_IMAGE_BYTES / 1024 / 1024}MB)`)
  }
  const arrayBuffer = await res.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`图片过大(>${MAX_IMAGE_BYTES / 1024 / 1024}MB)`)
  }
  const buffer = Buffer.from(arrayBuffer)
  return { buffer, contentType }
}

// =============================================================================
// 9. 手动触发趋势信号计算
// =============================================================================

/**
 * 手动触发趋势信号计算（管理员）。
 *
 * 遍历近 30 天有快照的条目，计算 7/14 天窗口的增长率与排名变化，
 * upsert 到 ai_feed_trend_signal 表，并同步 hot_item 的 trendTag（7 天窗口优先）。
 *
 * 与旧架构 server/app/services/ai_feed_service.py 的 compute_trend_signals 对齐。
 */
export async function computeTrendSignals(): Promise<{ processedItems: number }> {
  const windows = [7, 14]
  let count = 0

  for (const windowDays of windows) {
    const since = new Date()
    since.setDate(since.getDate() - windowDays)

    const snapshots = await db
      .select()
      .from(aiFeedSnapshot)
      .where(gte(aiFeedSnapshot.snapshotDate, since.toISOString().slice(0, 10)))

    const byItem = new Map<string, typeof snapshots>()
    for (const s of snapshots) {
      if (!s.itemId) continue
      const arr = byItem.get(s.itemId)
      if (arr) arr.push(s)
      else byItem.set(s.itemId, [s])
    }

    for (const [itemId, arr] of byItem) {
      if (arr.length < 2) continue
      const sorted = [...arr].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
      const first = sorted[0]!
      const last = sorted[sorted.length - 1]!
      const firstHot = Number(first.hotValue ?? 0)
      const lastHot = Number(last.hotValue ?? 0)
      const growthPct = firstHot > 0 ? ((lastHot - firstHot) / firstHot) * 100 : null
      const rankDelta = last.rank !== null && first.rank !== null ? first.rank - last.rank : null

      let trendTag = 'stable'
      if (growthPct !== null) {
        if (growthPct >= 15) trendTag = 'rising'
        else if (growthPct <= -15) trendTag = 'cooling'
      }

      await db
        .insert(aiFeedTrendSignal)
        .values({
          itemId,
          sourceCode: last.sourceCode,
          platformItemId: last.platformItemId,
          windowDays,
          growthPct,
          rankDelta,
          hotThen: firstHot || null,
          emaHot: lastHot || null,
          trendTag,
          snapshotCount: arr.length,
        })
        .onConflictDoUpdate({
          target: [aiFeedTrendSignal.itemId, aiFeedTrendSignal.windowDays],
          set: {
            growthPct,
            rankDelta,
            hotThen: firstHot || null,
            emaHot: lastHot || null,
            trendTag,
            snapshotCount: arr.length,
            updatedAt: new Date(),
          },
        })

      if (windowDays === 7) {
        await db
          .update(aiFeedHotItem)
          .set({
            trendTag,
            trendGrowthPct: growthPct,
            updatedAt: new Date(),
          })
          .where(eq(aiFeedHotItem.id, itemId))
      }
      count++
    }
  }

  return { processedItems: count }
}

// =============================================================================
// 10. 更新数据源配置
// =============================================================================

export interface UpdateSourcePatch {
  enabled?: boolean
  sortOrder?: number
  fetchIntervalMinutes?: number
  sourceName?: string
  description?: string
  category?: string
  color?: string
  icon?: string
}

/**
 * 更新数据源配置（启用/停用/排序/采集间隔等，管理员）。
 *
 * 与旧架构 server/app/api/v1/ai_feed/routes.py 的 PUT /sources/{source_id} 一致。
 */
export async function updateSource(
  sourceId: string,
  patch: UpdateSourcePatch,
): Promise<AiFeedSource | undefined> {
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.enabled !== undefined) set.enabled = patch.enabled
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (patch.fetchIntervalMinutes !== undefined)
    set.fetchIntervalMinutes = patch.fetchIntervalMinutes
  if (patch.sourceName !== undefined) set.sourceName = patch.sourceName
  if (patch.description !== undefined) set.description = patch.description
  if (patch.category !== undefined) set.category = patch.category
  if (patch.color !== undefined) set.color = patch.color
  if (patch.icon !== undefined) set.icon = patch.icon

  const rows = await db
    .update(aiFeedSource)
    .set(set)
    .where(eq(aiFeedSource.id, sourceId))
    .returning()
  return rows[0]
}
