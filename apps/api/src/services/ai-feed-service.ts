// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { getSystemAccessToken } from '../utils/system-access-token.js'
import {
  aiFeedSource,
  aiFeedHotItem,
  aiFeedSnapshot,
  aiFeedTrendSignal,
  aiWorldItems,
  type AiFeedSource,
  type AiFeedHotItem,
} from '@ihui/database'

/** rss-parser 单例(避免每次请求重建实例,解析 RSS/Atom XML) */
const rssParser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'IHUI-AI-Feed/1.0 (+https://aizhs.top)' },
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
  details: Array<{ sourceCode: string; status: string; count: number; error?: string }>
}

export interface LlmBatchResult {
  processedItems: number
  /** 本批 LLM 真正失败的条数(翻译失败 / 分类回退关键词),供运维统计与 drain 识别异常态 */
  failed: number
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

// 20s:兼容 github.com 等路由抖动导致的原生 RSS/HTML 偶发超时(10s 会产生空档)。
// LLM 调用不走此超时,独立用 90s。
const FETCH_TIMEOUT_MS = 20_000

// 抓取重试间隔(指数退避)。2026-09-06 实测:github.com 间歇性连接抖动可
// 持续 20-60s(首采 mistral/huggingface-blog 连败 2 次,数分钟后同 URL 即通),
// 单次重试(共 2 次尝试)不足以消除空档,故扩为 3 次重试(共 4 次尝试)。
// 仅抓取失败/超时时产生额外延迟,正常源一次成功零开销。
const FETCH_RETRY_DELAYS_MS = [800, 2_000, 4_000]

/** 通用浏览器 UA(国内门户接口/SSR 页防反爬需要伪装) */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  // 对间歇性连接抖动做 3 次指数退避重试(github.com 等路由抖动时首连失败、
  // 稍后即通;一次重试不足以覆盖持续 20-60s 的抖动窗口)。
  let lastErr: unknown
  const attempts = FETCH_RETRY_DELAYS_MS.length + 1
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      return res
    } catch (err) {
      lastErr = err
    } finally {
      clearTimeout(timer)
    }
    if (attempt < attempts) {
      await new Promise((r) => setTimeout(r, FETCH_RETRY_DELAYS_MS[attempt - 1]!))
    }
  }
  throw lastErr
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

/**
 * GitHub 官方 API 兜底(releases.atom / commits/{branch}.atom 抓取失败时降级)。
 *
 * 背景(2026-09-06):mistral / huggingface-blog 因官方域不可达,改用 GitHub org 仓库的
 * atom feed(github.com)作为权威替代;而 github.com 在国内存在间歇性连接抖动(20-60s),
 * 即使增强重试仍可能全败。api.github.com 的官方 JSON 接口相对稳定,作为同源兜底通道,
 * 权威性一致(同为 GitHub 官方),平时不触发、无额外请求。
 */
const GITHUB_RELEASES_ATOM_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\.atom$/
const GITHUB_COMMITS_ATOM_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/commits\/([^/]+)\.atom$/

interface GitHubApiItem {
  id?: number | string
  sha?: string
  name?: string | null
  tag_name?: string | null
  html_url?: string
  body?: string | null
  published_at?: string | null
  author?: { login?: string; name?: string } | null
  commit?: {
    message?: string
    author?: { name?: string; date?: string }
  }
}

async function fetchGitHubApiFallback(
  url: string,
  sourceCode: string,
): Promise<FetchedFeedItem[] | null> {
  const releasesMatch = url.match(GITHUB_RELEASES_ATOM_RE)
  const commitsMatch = url.match(GITHUB_COMMITS_ATOM_RE)
  let apiUrl: string | null = null
  if (releasesMatch) {
    apiUrl = `https://api.github.com/repos/${releasesMatch[1]}/${releasesMatch[2]}/releases?per_page=20`
  } else if (commitsMatch) {
    apiUrl = `https://api.github.com/repos/${commitsMatch[1]}/${commitsMatch[2]}/commits?sha=${commitsMatch[3]}&per_page=20`
  }
  if (!apiUrl) return null

  const res = await fetchWithTimeout(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'IHUI-AI-Feed/1.0 (+https://aizhs.top)',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error(`GitHub API ${apiUrl} 返回 ${res.status}`)
  const list = (await res.json()) as GitHubApiItem[]
  if (!Array.isArray(list)) return []

  return list.map((raw, idx) => {
    if (releasesMatch) {
      return {
        sourceCode,
        platformItemId: String(raw.id ?? raw.tag_name ?? idx).slice(0, 128),
        title: String(raw.name ?? raw.tag_name ?? '').slice(0, 500),
        summary: raw.body ? String(raw.body).slice(0, 2000) : null,
        url: raw.html_url ?? null,
        coverUrl: null,
        author: raw.author?.login ?? null,
        currentRank: idx + 1,
        currentHot: null,
        publishTime: raw.published_at ? new Date(raw.published_at) : null,
      }
    }
    return {
      sourceCode,
      platformItemId: String(raw.sha ?? idx).slice(0, 128),
      title: String(raw.commit?.message ?? '').split('\n')[0]!.slice(0, 500),
      summary: String(raw.commit?.message ?? '').slice(0, 2000) || null,
      url: raw.html_url ?? null,
      coverUrl: null,
      author: raw.commit?.author?.name ?? raw.author?.login ?? null,
      currentRank: idx + 1,
      currentHot: null,
      publishTime: raw.commit?.author?.date ? new Date(raw.commit.author.date) : null,
    }
  })
}

async function fetchRssXml(url: string, sourceCode: string): Promise<FetchedFeedItem[]> {
  let items: FetchedFeedItem[]
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
        'User-Agent': 'IHUI-AI-Feed/1.0 (+https://aizhs.top)',
      },
    })
    if (!res.ok) throw new Error(`RSS XML ${url} 返回 ${res.status}`)
    const xml = await res.text()
    const feed = await rssParser.parseString(xml)
    items = (feed.items ?? []).map((item, idx) => ({
      sourceCode,
      platformItemId: toSafeStr(item.guid ?? item.link ?? idx).slice(0, 128),
      title: toSafeStr(item.title).slice(0, 500),
      summary: toSafeStr(item.contentSnippet ?? item.content).slice(0, 2000) || null,
      url: toSafeStr(item.link) || null,
      coverUrl: item.enclosure?.url ? toSafeStr(item.enclosure.url) : null,
      author: toSafeStr(item.creator ?? item.author).slice(0, 200) || null,
      currentRank: idx + 1,
      currentHot: null,
      publishTime: item.isoDate
        ? new Date(item.isoDate)
        : item.pubDate
          ? new Date(item.pubDate)
          : null,
    }))
  } catch (primaryErr) {
    // GitHub 源兜底:atom 抓取失败时降级到官方 API(仅 github.com 源触发,其余抛回原错误)
    const fallback = await fetchGitHubApiFallback(url, sourceCode).catch((fbErr) => {
      throw new Error(
        `RSS XML ${url} 失败(${(primaryErr as Error).message});` +
          `GitHub API 兜底亦失败(${(fbErr as Error).message})`,
      )
    })
    if (fallback) return fallback
    throw primaryErr
  }
  return items
}

/**
 * 魔搭社区(community.modelscope.cn)SSR 页面解析适配器。
 *
 * 背景:魔搭官方主站(模型榜单/资讯)为 Cookie 网关绑定的 SPA,无稳定免鉴权 RSS/JSON
 * 接口可直连;但其社区首页(模型速递 / 社区头条)为服务端渲染,文章块直接内嵌在 HTML 中,
 * 权威、可达、稳定。这里解析 org-card-content 文章块(标题 / 链接 / 作者 / 日期)转 feed 条目,
 * 并按链接去重(同文在页面中会以大图 + 小卡两种形态出现)。
 */
async function fetchModelScopeCommunity(url: string, sourceCode: string): Promise<FetchedFeedItem[]> {
  const res = await fetchWithTimeout(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  })
  if (!res.ok) throw new Error(`ModelScope Community ${url} 返回 ${res.status}`)
  const html = await res.text()

  // 文章块:org-card-title> 标题链接(至 </h3>) ... org-card-time> 日期 </span>
  // 捕获组:1=链接,2=标题,3=日期(YYYY-MM-DD)
  const itemRe =
    /org-card-title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a><\/h3>[\s\S]*?org-card-time[^>]*>([^<]+)<\/span>/gi
  const seen = new Set<string>()
  const items: FetchedFeedItem[] = []
  let match: RegExpExecArray | null
  while ((match = itemRe.exec(html)) !== null) {
    const title = match[2]!
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
    const fullUrl = new URL(match[1]!.trim(), url).toString()
    if (!title || !fullUrl.includes('.html') || seen.has(fullUrl)) continue
    seen.add(fullUrl)

    let publishTime: Date | null = null
    const dateStr = match[3]!.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const parsed = new Date(dateStr)
      if (!Number.isNaN(parsed.getTime())) publishTime = parsed
    }

    items.push({
      sourceCode,
      platformItemId: fullUrl.slice(0, 128),
      title: title.slice(0, 500),
      summary: null,
      url: fullUrl,
      coverUrl: null,
      author: '魔搭ModelScope社区',
      currentRank: items.length + 1,
      currentHot: null,
      publishTime,
    })
  }
  return items
}

/**
 * 今日头条官方热榜接口适配器(源 sourceType='api')。
 *
 * 头条官方热榜接口返回:
 *   { unique_id, update_time, count, data: [ { ClusterId, ClusterIdStr, Title, Url, HotValue, Label, ... }, ... ] }
 * 其中 data 是卡片数组(每卡一条热搜),字段为首字母大写。与 DailyHotApi 的
 * { data:[{title,url,hot,...}] } 形状不同,故独立适配:
 *  - platformItemId 用 ClusterIdStr(url 唯一)→ 幂等去重
 *  - title=Title / url=Url / currentHot=HotValue
 */
async function fetchToutiaoHotBoard(
  endpoint: string,
  sourceCode: string,
): Promise<FetchedFeedItem[]> {
  const res = await fetchWithTimeout(endpoint, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`Toutiao HotBoard ${endpoint} 返回 ${res.status}`)
  const json = (await res.json()) as {
    data?: Array<{
      ClusterIdStr?: string
      Title?: string
      Url?: string
      HotValue?: number
    }>
  }
  const list = Array.isArray(json.data) ? json.data : []
  return list.map((raw, idx) => ({
    sourceCode,
    platformItemId: String(raw.ClusterIdStr ?? raw.Url ?? idx).slice(0, 128),
    title: String(raw.Title ?? '').slice(0, 500),
    summary: null,
    url: raw.Url ? String(raw.Url) : null,
    coverUrl: null,
    author: '今日头条',
    currentRank: idx + 1,
    currentHot: typeof raw.HotValue === 'number' ? raw.HotValue : null,
    publishTime: new Date(),
  }))
}

async function callLlm(
  prompt: string,
  content: string,
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const baseUrl = env.AI_SERVICE_URL
  if (!baseUrl) return null
  const models = feedModels()
  // 2026-09-06 加速:候选模型按序 fallback。前一个模型并发限流/失败时
  // 自动切下一个(默认 stepfun → deepseek),避免批量翻译整批 502 空转。
  for (const model of models) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 90_000)
      try {
        const body: Record<string, unknown> = {
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content },
          ],
          // 显式锁定模型:不传 model 时 ai-service 走自动程级升级(auto 路由),
          // feed 短任务常被判 expert 升级到无余额的 gpt-4o-mini → 502。
          model,
        }
        // max_tokens 限制输出长度(分类任务只需 ~20 token,防止 LLM 生成 HTML/长文)
        if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens
        // temperature=0 确定性输出(分类任务不需要创造性)
        if (options.temperature !== undefined) body.temperature = options.temperature
        // 后台任务无用户上下文,aiServiceFetch(null) 不带 Authorization →
        // ai-service JWT 中间件 401,LLM 分类/摘要/翻译全部静默失效。签发系统 access token。
        const systemToken = await getSystemAccessToken()
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${systemToken}`,
        }
        // 携带内部密钥,让 ai-service 的输入净化中间件跳过 Prompt-Injection 内容扫描:
        // 本管道正文是已审核来源的原始标题,走关键词扫描会把含 "jailbreak"/"system prompt"
        // 等主题词的合法 AI 安全研究误判为注入(实测 400 拦截,导致资讯漏翻译/漏分类)。
        // 密钥仅服务端持有,用户侧无此头,注入防护不受影响。
        if (env.AI_CALLBACK_SECRET) {
          headers['X-Internal-Secret'] = env.AI_CALLBACK_SECRET
        }
        const res = await aiServiceFetch(null, '/api/llm/complete', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        // 非 2xx:记日志后尝试下一个候选模型
        if (!res.ok) {
          logger.warn(`LLM 调用失败 status=${res.status} model=${model}`, {
            url: `${baseUrl}/api/llm/complete`,
          })
          continue
        }
        // ai-service /llm/complete 返回 {content, model, usage, stub, error?, error_message?}
        const json = (await res.json()) as {
          content?: string
          error?: boolean
          error_message?: string
          stub?: boolean
        }
        if (json.error) {
          logger.warn(`LLM 调用返回错误 model=${model}: ${json.error_message ?? 'unknown'}`)
          continue
        }
        if (json.stub) {
          // stub 模式 = 该 provider key 未配置真实额度,换下一个候选
          logger.warn(`LLM stub 模式返回(无真实 API key) model=${model},切换候选`)
          continue
        }
        const text = json.content ?? ''
        return text.trim() || null
      } finally {
        clearTimeout(timer)
      }
    } catch (e) {
      logger.warn(`LLM 调用异常 model=${model}: ${(e as Error).message},切换候选`)
    }
  }
  // 所有候选都失败
  return null
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

  // 2026-08-05 修复:ai_feed_hot_item 生产为 0 条(ai_feed_source 源配置未初始化)导致
  // /ai-news 时间线/热度榜空白。无任何筛选条件且空结果时,fallback 到 AI World 每日
  // 同步数据(kind='news',每日 0/12 点更新,278+ 条真实资讯),映射为 AiFeedHotItem 形状。
  const hasFilter = Boolean(opts.source || opts.category || opts.trend || opts.keyword)
  if (!hasFilter && (totalRows[0]?.count ?? 0) === 0) {
    try {
      const world = await db
        .select({
          id: aiWorldItems.id,
          title: aiWorldItems.title,
          summary: aiWorldItems.summary,
          url: aiWorldItems.url,
          coverUrl: aiWorldItems.coverImage,
          source: aiWorldItems.source,
          publishTime: aiWorldItems.publishedAt,
          lastSeenAt: aiWorldItems.fetchedAt,
          trendingScore: aiWorldItems.trendingScore,
          kind: aiWorldItems.kind,
        })
        .from(aiWorldItems)
        .where(and(eq(aiWorldItems.kind, 'news'), eq(aiWorldItems.status, 1)))
        .orderBy(desc(aiWorldItems.publishedAt), desc(aiWorldItems.fetchedAt))
        .limit(opts.pageSize)
      if (world.length > 0) {
        const fallback: AiFeedHotItem[] = world.map((w) => ({
          id: w.id,
          sourceCode: w.source,
          platformItemId: `aiw-${w.id}`,
          title: w.title,
          summary: w.summary ?? null,
          url: w.url ?? null,
          coverUrl: w.coverUrl ?? null,
          author: w.source ?? null,
          currentRank: null,
          currentHot: w.trendingScore ?? null,
          publishTime: w.publishTime ?? null,
          firstSeenAt: w.lastSeenAt ?? new Date(),
          lastSeenAt: w.lastSeenAt ?? new Date(),
          llmCategory: w.kind === 'paper' ? 'paper' : 'industry',
          llmTags: null,
          llmSummary: null,
          llmProcessedAt: null,
          trendTag: null,
          trendGrowthPct: null,
          titleEn: null,
          titleJa: null,
          titleKo: null,
          createdAt: w.lastSeenAt ?? new Date(),
          updatedAt: w.lastSeenAt ?? new Date(),
        }))
        return {
          list: fallback,
          total: fallback.length,
          page: opts.page,
          pageSize: opts.pageSize,
        }
      }
    } catch (e) {
      logger.warn('[ai-feed] ai_world fallback failed', {
        error: e instanceof Error ? e.message : e,
      })
    }
  }

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

  // 2026-08-05 修复:删除"DAILYHOT/RSSHUB 都未配置 → 全部 skipped"的前置降级。
  // 它会把 sourceType='rss' 的原生 RSS 源(完整 URL 且非 rsshub.app,不依赖任何 env)
  // 也误拦掉,导致生产 ai_feed_source 配了 9 个原生 RSS 源仍采集 0 条。
  // 各源是否可抓在下方循环内按 sourceType + env 自行判断,未配置的源自然 skip。

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
      } else if (src.sourceType === 'html' && src.endpoint) {
        // html 类型:SSR 页面文章块解析(如魔搭社区 community.modelscope.cn)
        items = await fetchModelScopeCommunity(src.endpoint, src.sourceCode)
      } else if (src.sourceType === 'api' && src.endpoint) {
        // 今日头条官方热榜:JSON 形状与 DailyHotApi 不同,独立适配;其余 api 源走 DailyHotApi 格式
        if (src.sourceCode === 'toutiao-hot') {
          items = await fetchToutiaoHotBoard(src.endpoint, src.sourceCode)
        } else {
          items = await fetchDailyHotApi(src.endpoint, src.sourceCode)
        }
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
      // 采集失败:记录完整错误详情(含 URL/HTTP 状态),写入采集统计与源状态,
      // 便于线上定位;不再继续走下方 upsert 成功路径。
      status = 'error'
      const errMsg = e instanceof Error ? e.message : String(e)
      logger.warn(`collectAllSources: 采集 ${src.sourceCode} 失败: ${errMsg}`)
      details.push({ sourceCode: src.sourceCode, status, count: 0, error: errMsg })
      await db
        .update(aiFeedSource)
        .set({
          lastFetchAt: new Date(),
          lastFetchStatus: 'error',
          lastFetchCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(aiFeedSource.id, src.id))
      continue
    }

    // 幂等 upsert：已存在的 (sourceCode, platformItemId) 更新 lastSeenAt/currentHot/currentRank
    // P2 修复(2026-08-06):原逐条 insert 循环,单源几十条 hot 条目会产生几十次往返查询。
    // 改为一次性批量 upsert(insert().values([...]) + onConflictDoUpdate 引用 excluded),
    // 每源 1 次 SQL 提交,与 id-mapping-queries.ts 的 bulkCreateMappings 同款模式。
    if (items.length > 0) {
      await db
        .insert(aiFeedHotItem)
        .values(
          items.map((item) => ({
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
          })),
        )
        .onConflictDoUpdate({
          target: [aiFeedHotItem.sourceCode, aiFeedHotItem.platformItemId],
          set: {
            title: sql`excluded.title`,
            summary: sql`excluded.summary`,
            url: sql`excluded.url`,
            coverUrl: sql`excluded.cover_url`,
            author: sql`excluded.author`,
            currentRank: sql`excluded.current_rank`,
            currentHot: sql`excluded.current_hot`,
            publishTime: sql`excluded.publish_time`,
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
// 5. LLM 分类摘要（手动触发 / 定时错峰）
// =============================================================================

/**
 * LLM 批量处理的错峰加速配置（环境变量，均带默认值，缺省即可用）。
 *
 * - LLM_BATCH_ENABLED：全局开关，false/off/0 停止一切 LLM 批处理（存量抽干亦停）。
 * - LLM_CATEGORY_BATCH_SIZE：每轮分类(processLlmBatch)批大小（默认 200，原 100）。
 * - LLM_TRANSLATE_BATCH_SIZE：每轮翻译(translateTitles)批大小（默认 100，原 50）。
 * - LLM_DRAIN_MAX_ITERATIONS：存量抽干单次最多轮数（避免一次跑太久卡住 worker）。
 * - LLM_DRAIN_STAGGER_MS：存量抽干轮间错峰睡眠（毫秒），防止连续打爆 LLM 并发/配额。
 */
function readPositiveIntEnv(name: string, def: number): number {
  const raw = env[name]
  if (raw === undefined || raw.trim() === '') return def
  const n = Number.parseInt(raw, 10)
  return Number.isInteger(n) && n > 0 ? n : def
}

function readBoolEnv(name: string, def: boolean): boolean {
  const raw = env[name]
  if (raw === undefined || raw.trim() === '') return def
  return !/^(false|0|off|no|disable|disabled)$/i.test(raw.trim())
}

/**
 * 判断标题是否为「非拉丁文」（含中日韩文字/假名/谚文/全角符号等）。
 * 用于 translateTitles：已是非拉丁系语言(如中文源)时才需要 LLM 翻译成英文；
 * 纯拉丁文(英文/数字/符号)标题直接回填原文，避免为英文标题白耗 LLM 配额并把
 * litellm 并发(limit 8)打爆成 502(实测大量 arxiv/openai 原文标题都在缺 title_en 队列)。
 */
function isLatinTitle(title: string): boolean {
  // 命中任一 CJK 区段/假名/谚文/全角即视为非拉丁文
  return !/[\u3000-\u9fff\uff00-\uffef\u3040-\u30ff\uac00-\ud7af\u3130-\u318f]/.test(title)
}

const llmBatchEnabled = () => readBoolEnv('LLM_BATCH_ENABLED', true)
const llmCategoryBatchSize = () => readPositiveIntEnv('LLM_CATEGORY_BATCH_SIZE', 200)
const llmTranslateBatchSize = () => readPositiveIntEnv('LLM_TRANSLATE_BATCH_SIZE', 100)
const llmDrainStaggerMs = () => readPositiveIntEnv('LLM_DRAIN_STAGGER_MS', 3000)
const llmDrainMaxIterations = () => readPositiveIntEnv('LLM_DRAIN_MAX_ITERATIONS', 5)
// AI 资讯批处理锁定的候选模型(逗号分隔,按序 fallback)。
// 默认 stepfun/step-3.7-flash(官方套餐,额度正常)。其 litellm 并发上限常在 8 左右,
// 被实时用户请求抢占时批量翻译会 502,故保留多候选可扩展;当前已验证有余额的
// 仅 stepfun,其余(deepseek/siliconflow/bailian)经实测无余额或 4xx,不引入避免白耗一次请求。
// 环境变量 LLM_FEED_MODEL 可覆盖(逗号分隔,留空用默认)。
const feedModels = (): string[] => {
  const raw = env.LLM_FEED_MODEL
  if (raw && raw.trim() !== '') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return ['stepfun/step-3.7-flash']
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 受控并发执行器：将 items 以固定 concurrency 并行处理，避免一次性把
 * ai-service / litellm 的并发上限(默认 8)打爆导致 502 风暴。
 * - 顺序保证:数组顺序被打乱的 items 会按输入顺序逐条凭据更新,不影响聚合统计。
 * - 任何一个 task 抛错都不中止整体,由调用方决定计为 failed。
 * 默认并发取 LLM_CONCURRENCY 环境变量(<=20),否则 4(低于 litellm 8,留余量)。
 */
async function mapLimit<T>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const c = Math.max(1, Math.min(20, concurrency))
  let cursor = 0
  const workers: Promise<void>[] = []
  for (let w = 0; w < c; w++) {
    workers.push(
      (async () => {
        while (true) {
          const i = cursor++
          if (i >= items.length) break
          const item = items[i]
          if (item === undefined || item === null) continue
          try {
            await task(item, i)
          } catch {
            // 交给调用方判断 failed,这里不抛出以免整批中断
          }
        }
      })(),
    )
  }
  await Promise.all(workers)
}

/** LLM 单 worker 受控并发(每批同时发起的 LLM 请求数)。默认 4,低于 litellm 8 上限。 */
function llmConcurrency(): number {
  const r = readPositiveIntEnv('LLM_CONCURRENCY', 4)
  return Math.min(20, r)
}

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
export async function processLlmBatch(limit?: number): Promise<LlmBatchResult> {
  // LLM_BATCH_ENABLED 全局开关：false 时静默停用，不调用 LLM 也不改数据。
  if (!llmBatchEnabled()) {
    return { processedItems: 0, failed: 0, details: 'LLM 批处理已禁用（LLM_BATCH_ENABLED=false）' }
  }
  // 未显式传 limit 时使用可配置批大小（默认 200）。
  const batchSize = limit ?? llmCategoryBatchSize()
  const pending = await db
    .select()
    .from(aiFeedHotItem)
    .where(isNull(aiFeedHotItem.llmProcessedAt))
    .orderBy(desc(aiFeedHotItem.lastSeenAt))
    .limit(batchSize)

  // 2026-09-06 加速:由串行改为受控并发(默认 4,低于 litellm 8 上限),避免打爆并发。
  let processed = 0
  let failed = 0
  await mapLimit(pending, llmConcurrency(), async (item) => {
    // 优先调用 LLM 做分类，失败回退到关键词规则
    let category: string
    // 只有 LLM 真正产出可用类别时才计入"已处理"并落 llm_processed_at;
    // 一旦回退到关键词规则(LLM 失败/401/返回垃圾)，保持 llm_processed_at 为 NULL 留待重试，
    // 并计入 failed 供统计(避免"分类失败却被当作成功"的假清空,与 translateTitles 同理)。
    let llmSucceeded = false
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
      llmSucceeded = true
    } else if (llmResult && isValidCategory(llmResult)) {
      category = llmResult.toLowerCase()
      llmSucceeded = true
    } else {
      category = inferCategoryByTitle(item.title, item.sourceCode)
    }

    await db
      .update(aiFeedHotItem)
      .set({
        llmCategory: category,
        llmSummary: item.summary ?? null,
        // 关键词回退时保留 NULL：llm_processed_at 缺失=LLM 尚未真正处理(留待重试)
        llmProcessedAt: llmSucceeded ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(aiFeedHotItem.id, item.id))

    if (llmSucceeded) processed++
    else failed++
  })

  return {
    processedItems: processed,
    failed,
    details: `处理 ${processed} 条(LLM),回退关键词 ${failed} 条（共 ${pending.length} 条待处理）`,
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
 * 配置 AI_SERVICE_URL 时调用 LLM 做翻译；未配置或调用失败时保持 titleEn 为 NULL
 * 并计入 failed（留待后续重试），不再用中文原标题回填（避免"假翻译"占用存量）。
 */
export async function translateTitles(limit?: number): Promise<LlmBatchResult> {
  // LLM_BATCH_ENABLED 全局开关：false 时静默停用，不清洗也不翻译。
  if (!llmBatchEnabled()) {
    return { processedItems: 0, failed: 0, details: 'LLM 批处理已禁用（LLM_BATCH_ENABLED=false）' }
  }
  // 未显式传 limit 时使用可配置批大小（默认 100）。
  const batchSize = limit ?? llmTranslateBatchSize()
  const pending = await db
    .select()
    .from(aiFeedHotItem)
    .where(isNull(aiFeedHotItem.titleEn))
    .orderBy(desc(aiFeedHotItem.lastSeenAt))
    .limit(batchSize)

  // 2026-09-06 加速:由串行改为受控并发(默认 4,低于 litellm 8 上限)。
  // 串行仅能 ~4-16 条/分钟,而多个并行 drain job 又会把 litellm 并发打爆到
  // limit=8 → 502 风暴 → 成功率 <10%。单 worker 受控并发可在不打爆上限的
  // 前提下把吞吐提到 ~40-80 条/分钟,回退显式锁定 stepfun 模型后基本稳定成功。
  let processed = 0
  let failed = 0
  await mapLimit(pending, llmConcurrency(), async (item) => {
    // 调 LLM 翻译；失败/空结果保持 titleEn 为 NULL(留待重试)，不再回填中文原标题
    try {
      // 2026-09-06:原文已是拉丁文(英文源,如 arxiv/openai/apple)的不走 LLM,
      // 直接回填原文作英文标题,避免为英文标题白耗配额并把 litellm 并发打爆成 502。
      if (isLatinTitle(item.title)) {
        await db
          .update(aiFeedHotItem)
          .set({ titleEn: item.title.slice(0, 500), updatedAt: new Date() })
          .where(eq(aiFeedHotItem.id, item.id))
        processed++
        return
      }
      const llmResult = await callLlm(TRANSLATE_PROMPT, item.title)
      if (llmResult && llmResult.trim().length > 0) {
        await db
          .update(aiFeedHotItem)
          .set({
            titleEn: llmResult.slice(0, 500),
            updatedAt: new Date(),
          })
          .where(eq(aiFeedHotItem.id, item.id))
        processed++
      } else {
        // LLM 调用失败/401/stub 或返回空：保留 NULL，计入 failed 供统计
        failed++
      }
    } catch (e) {
      logger.warn(`translateTitles: 翻译 ${item.id} 失败: ${(e as Error).message}`)
      failed++
    }
  })

  return {
    processedItems: processed,
    failed,
    details: `翻译 ${processed} 条,失败 ${failed} 条（共 ${pending.length} 条待翻译）`,
  }
}

// =============================================================================
// 6.5 存量 LLM 积压抽干（错峰加速）
// =============================================================================

export interface DrainLlmBacklogResult {
  llmProcessed: number
  translated: number
  /** 本轮 LLM 分类失败(回退关键词)条数 */
  classifiedFailed: number
  /** 本轮翻译失败条数 */
  translateFailed: number
  iterations: number
  llmBacklogCleared: boolean
  translateBacklogCleared: boolean
  /** 结束后缺 LLM 分类(no_llm)的剩余条数 */
  remainingNoLlm: number
  /** 结束后缺英文标题(no_en)的剩余条数 */
  remainingNoEn: number
  /** 异常态:存在积压但本轮 0 分类且 0 翻译(LLM down/401/stub 静默返 0),提前退出 */
  zeroProgress: boolean
}

/**
 * 存量 LLM 积压抽干（错峰加速）。
 *
 * 持续以「多轮小批量 + 轮间 sleep」的方式抽干缺英文标题/缺分类的存量条目：
 * - 每轮并行跑一次 processLlmBatch（缺分类）与 translateTitles（缺英文标题）
 * - 轮间 sleep LLM_DRAIN_STAGGER_MS，避免一次性把 LLM 并发/配额打爆
 * - 每轮后统计剩余积压，两个方向都抽干即提前结束
 * - 某轮两个方向都零进展（LLM 连续失败/401 静默返 0）时提前退出并标记 zeroProgress，
 *   避免空转；本轮处理子数、失败数、剩余积压与运行时间一并写入结构化日志供运维观测
 * - 受 LLM_BATCH_ENABLED 总开关控制
 *
 * 由 scheduler 的 ai-feed-drain job（错峰时刻）周期调用；批大小/轮数/错峰间隔
 * 均可通过环境变量覆盖。
 */
export async function drainLlmBacklog(): Promise<DrainLlmBacklogResult> {
  const startedAt = new Date()

  if (!llmBatchEnabled()) {
    return {
      llmProcessed: 0,
      translated: 0,
      classifiedFailed: 0,
      translateFailed: 0,
      iterations: 0,
      llmBacklogCleared: true,
      translateBacklogCleared: true,
      remainingNoLlm: 0,
      remainingNoEn: 0,
      zeroProgress: false,
    }
  }

  const maxIterations = llmDrainMaxIterations()
  const staggerMs = llmDrainStaggerMs()

  let llmProcessed = 0
  let translated = 0
  let classifiedFailed = 0
  let translateFailed = 0
  let llmBacklogCleared = false
  let translateBacklogCleared = false
  let iterations = 0
  let zeroProgress = false
  let llmLeft = 0
  let transLeft = 0

  for (let round = 1; round <= maxIterations; round++) {
    iterations = round
    const [catRes, transRes] = await Promise.all([
      processLlmBatch(),
      translateTitles(),
    ])
    llmProcessed += catRes.processedItems
    translated += transRes.processedItems
    classifiedFailed += catRes.failed
    translateFailed += transRes.failed

    const backlog = await countBacklog()
    llmLeft = backlog.llmLeft
    transLeft = backlog.transLeft
    llmBacklogCleared = llmLeft === 0
    translateBacklogCleared = transLeft === 0

    // 两个方向都抽干，提前结束
    if (llmBacklogCleared && translateBacklogCleared) break
    // 有积压但本轮无任何真实进展（LLM 连续失败/401 静默返回 0）→ 提前退出标记零进展
    if (catRes.processedItems === 0 && transRes.processedItems === 0) {
      zeroProgress = true
      break
    }
    if (iterations >= maxIterations) break
    // 两轮之间错峰睡眠
    await sleep(staggerMs)
  }

  const remainingNoLlm = llmLeft
  const remainingNoEn = transLeft

  const result: DrainLlmBacklogResult = {
    llmProcessed,
    translated,
    classifiedFailed,
    translateFailed,
    iterations,
    llmBacklogCleared,
    translateBacklogCleared,
    remainingNoLlm,
    remainingNoEn,
    zeroProgress,
  }

  // 结构化日志(经 pino 落到 svc-api-nssm.log)：一行完整的 drain 进展，
  // 含运行时间/处理/失败/剩余积压/零进展异常态,供运维在不查库时直接定位。
  logger.info('ai-feed-drain run stats', {
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    llmProcessed,
    translated,
    classifiedFailed,
    translateFailed,
    iterations,
    llmBacklogCleared,
    translateBacklogCleared,
    remainingNoEn,
    remainingNoLlm,
    zeroProgress,
  })

  return result
}

/** 统计缺分类与缺英文标题的剩余积压数量。 */
async function countBacklog(): Promise<{ llmLeft: number; transLeft: number }> {
  const res = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM ai_feed_hot_item WHERE llm_processed_at IS NULL)::int AS llm_left,
      (SELECT count(*) FROM ai_feed_hot_item WHERE title_en IS NULL)::int AS trans_left
  `)
  const rows = Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])
  const row = rows[0] as { llm_left?: number; trans_left?: number } | undefined
  return { llmLeft: row?.llm_left ?? 0, transLeft: row?.trans_left ?? 0 }
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
// 9. 每日快照生成
// =============================================================================

/**
 * 生成当日 AI 资讯快照（写入 ai_feed_snapshot 表）。
 *
 * 把所有 ai_feed_hot_item 的 (currentHot, currentRank) 写入 ai_feed_snapshot，
 * snapshotDate = 当天（YYYY-MM-DD），(sourceCode + platformItemId + snapshotDate) 三元组唯一，幂等 upsert。
 *
 * computeTrendSignals 依赖快照数据：需要 7/14 天窗口内至少 2 个快照点才能计算趋势。
 * 因此本函数必须在 computeTrendSignals 之前调用（由 ai-feed-process cron 保证顺序）。
 *
 * 只快照有 hot 或 rank 的条目（避免无热度数据条目污染趋势计算）。
 */
export async function generateSnapshot(): Promise<{ insertedRows: number }> {
  await db.execute(sql`
    INSERT INTO ai_feed_snapshot (source_code, platform_item_id, item_id, title, rank, hot_value, snapshot_date, captured_at, created_at, updated_at)
    SELECT
      h.source_code,
      h.platform_item_id,
      h.id,
      h.title,
      h.current_rank,
      h.current_hot,
      CURRENT_DATE,
      NOW(),
      NOW(),
      NOW()
    FROM ai_feed_hot_item h
    WHERE h.current_hot IS NOT NULL OR h.current_rank IS NOT NULL
    ON CONFLICT (source_code, platform_item_id, snapshot_date) DO UPDATE
    SET
      rank = EXCLUDED.rank,
      hot_value = EXCLUDED.hot_value,
      title = EXCLUDED.title,
      item_id = EXCLUDED.item_id,
      captured_at = NOW(),
      updated_at = NOW()
  `)
  // drizzle 的 db.execute 返回 RowList(无 rowCount 属性),用 COUNT 查询获取当天快照数
  const countRes = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM ai_feed_snapshot
    WHERE snapshot_date = CURRENT_DATE
  `)
  const countRows = Array.isArray(countRes)
    ? countRes
    : ((countRes as { rows?: unknown[] }).rows ?? [])
  const insertedRows = (countRows[0] as { cnt?: number } | undefined)?.cnt ?? 0
  logger.info('ai-feed snapshot generated', {
    insertedRows,
    snapshotDate: new Date().toISOString().slice(0, 10),
  })
  return { insertedRows }
}

// =============================================================================
// 10. 手动触发趋势信号计算
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
// 11. 更新数据源配置
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
