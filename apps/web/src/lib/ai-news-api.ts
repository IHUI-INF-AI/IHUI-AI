/**
 * AI 资讯落地页 API 客户端
 *
 * 数据源:后端 /api/news/articles + /api/live/channels
 * 失败降级:本地 mock 数据(基于 packages/database/seed/ai-fresh-2026.ts 2026-07 真实资讯)
 *
 * 设计原则(AGENTS.md §4 配套):
 * - API 缺口 graceful fallback,清晰显示"暂无最新数据,请先跑 seed"
 * - 时间统一 Intl.DateTimeFormat 格式
 * - 头像 fallback 使用 initials
 */

import { fetchApi } from './api'

export interface AiNewsArticle {
  id: string
  title: string
  summary: string
  coverImage: string
  authorName: string
  categoryName: string
  viewCount: number
  publishedAt: string
  isPinned: boolean
  source: 'api' | 'mock'
}

export interface AiLiveChannel {
  id: string
  title: string
  intro: string
  coverImage: string
  lecturerName: string
  categoryName: string
  isLive: boolean
  viewCount: number
  source: 'api' | 'mock'
}

export interface AiFundingItem {
  id: string
  title: string
  amount: string
  source: string
  date: string
  summary: string
  link?: string
}

export interface ComparisonRow {
  label: string
  values: Record<string, string>
}

export interface ComparisonModel {
  id: string
  name: string
  vendor: string
  highlight: string
}

export interface ComparisonTable {
  models: ComparisonModel[]
  rows: ComparisonRow[]
}

const FALLBACK_ARTICLES: AiNewsArticle[] = [
  {
    id: 'mock-gpt-5-6',
    title: 'GPT-5.6 系列正式上线:三档分层定价,Sol 编程能力领先所有模型',
    summary:
      'OpenAI 发布 GPT-5.6 系列三款模型 Sol/Terra/Luna,Sol 在 Coding Agent Index 以 80 分领先,价格仅约 Claude Fable 5 的三分之一。',
    coverImage:
      'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
    authorName: 'AI 前沿观察',
    categoryName: 'AI 模型发布',
    viewCount: 8420,
    publishedAt: '2026-07-09T10:00:00+08:00',
    isPinned: true,
    source: 'mock',
  },
  {
    id: 'mock-claude-sonnet-5',
    title: 'Claude Sonnet 5 发布:最具智能体能力的中端模型,3 美元起入门',
    summary:
      'Anthropic 发布 Claude Sonnet 5,智能体评测显著优于 Sonnet 4.6,部分任务接近 Opus 4.8,入门价仅 3 美元。',
    coverImage:
      'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
    authorName: 'AI 前沿观察',
    categoryName: 'AI 模型发布',
    viewCount: 6210,
    publishedAt: '2026-07-01T10:00:00+08:00',
    isPinned: true,
    source: 'mock',
  },
  {
    id: 'mock-kimi-k3',
    title: 'Kimi K3 重磅发布:2.8 万亿参数,全球最大开源模型',
    summary:
      '月之暗面在 2026 WAIC 大会发布 Kimi K3,2.8 万亿参数,100 万 token 上下文,原生支持视觉理解。',
    coverImage: 'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/01-open-world.png',
    authorName: '央视新闻',
    categoryName: 'AI 模型发布',
    viewCount: 12380,
    publishedAt: '2026-07-17T09:30:00+08:00',
    isPinned: true,
    source: 'mock',
  },
  {
    id: 'mock-gemini-3-5-pro',
    title: 'Gemini 3.5 Pro 发布:2M 上下文,前端代码生成王者',
    summary:
      '谷歌 DeepMind 放弃 2.5 Pro 基座,全新预训练 Gemini 3.5 Pro,主打"质量优先于速度",SVG 与前端页面一次生成。',
    coverImage:
      'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
    authorName: 'AI 前沿观察',
    categoryName: 'AI 模型发布',
    viewCount: 5460,
    publishedAt: '2026-07-17T11:00:00+08:00',
    isPinned: false,
    source: 'mock',
  },
  {
    id: 'mock-deepseek-v4',
    title: 'DeepSeek V4 正式版上线:峰谷定价 + DSpark 加速 85%',
    summary:
      'DeepSeek V4 引入峰谷分时计费(9-12、14-18 高峰 2 倍),联合北大发布 DSpark 推理加速框架。',
    coverImage: 'https://cdn.deepseek.com/images/deepseek-chat-open-graph-image.jpeg',
    authorName: 'DeepSeek 官方',
    categoryName: 'AI 模型发布',
    viewCount: 9120,
    publishedAt: '2026-07-17T14:00:00+08:00',
    isPinned: true,
    source: 'mock',
  },
  {
    id: 'mock-waic-2026',
    title: 'WAIC 2026 在上海开幕:9 位图灵奖诺奖得主参会',
    summary:
      '2026 世界人工智能大会 7 月 17-20 日在上海启幕,理查德·萨顿主旨演讲,凯文·凯利畅谈具身智能。',
    coverImage:
      'https://static.www.tencent.com/uploads/2026/07/06/10c8b5b34b4793c92e448b2656379b6e.png!article.cover',
    authorName: '观察者网',
    categoryName: 'AI 产业动态',
    viewCount: 14720,
    publishedAt: '2026-07-17T08:30:00+08:00',
    isPinned: true,
    source: 'mock',
  },
]

const FALLBACK_LIVE_CHANNELS: AiLiveChannel[] = [
  {
    id: 'mock-live-gpt-5-6',
    title: 'GPT-5.6 Sol 首发深度解读:三档分层如何重塑 AI 编程?',
    intro: 'OpenAI 于 7 月 9 日发布 GPT-5.6 系列,本场拆解 Sol 在 Coding Agent Index 上 80 分领先。',
    coverImage:
      'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
    lecturerName: 'AI 前沿观察',
    categoryName: 'AI 前沿发布',
    isLive: true,
    viewCount: 4280,
    source: 'mock',
  },
  {
    id: 'mock-live-claude-sonnet-5',
    title: 'Claude Sonnet 5 智能体能力实战:从 0 到 1 搭建 Agent 工作流',
    intro: '本场演示 Sonnet 5 在 BrowseComp、OSWorld-Verified 等智能体评测中的突破。',
    coverImage:
      'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
    lecturerName: '王立铭',
    categoryName: 'AI 工程师实战',
    isLive: true,
    viewCount: 3120,
    source: 'mock',
  },
  {
    id: 'mock-live-kimi-k3',
    title: 'Kimi K3 2.8 万亿参数开源大模型深度拆解',
    intro: '月之暗面 7 月 17 日发布 Kimi K3,本场剖析它在编程、视觉、长程任务上的综合表现。',
    coverImage: 'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/01-open-world.png',
    lecturerName: 'AI 前沿观察',
    categoryName: 'AI 前沿发布',
    isLive: true,
    viewCount: 5640,
    source: 'mock',
  },
  {
    id: 'mock-live-waic-2026',
    title: 'WAIC 2026 主论坛现场直播:理查德·萨顿强化学习主旨演讲',
    intro: '强化学习之父理查德·萨顿主旨演讲,凯文·凯利、约书亚·本吉奥、姚期智同台。',
    coverImage:
      'https://static.www.tencent.com/uploads/2026/07/06/10c8b5b34b4793c92e448b2656379b6e.png!article.cover',
    lecturerName: 'AI 前沿观察',
    categoryName: 'AI 前沿发布',
    isLive: true,
    viewCount: 8970,
    source: 'mock',
  },
]

const FALLBACK_FUNDING: AiFundingItem[] = [
  {
    id: 'mock-fund-spacex-cursor',
    title: 'SpaceX 600 亿美元收购 Cursor',
    amount: '600 亿美元',
    source: 'ZDNnet',
    date: '2026-07-08',
    summary: '马斯克旗下 SpaceX 宣布以 600 亿美元收购 AI 编程工具 Cursor,xAI 将与之深度整合。',
  },
  {
    id: 'mock-fund-deepseek-500',
    title: 'DeepSeek 完成 500 亿元融资',
    amount: '500 亿元',
    source: '观察者网',
    date: '2026-07-15',
    summary: 'DeepSeek 7 月完成 500 亿元融资,首次对外发布开源技术成果,估值进入独角兽俱乐部。',
  },
  {
    id: 'mock-fund-sk-hynix',
    title: 'SK hynix 265 亿美元 IPO',
    amount: '265 亿美元',
    source: 'TechCrunch',
    date: '2026-07-10',
    summary: 'SK hynix 美国 IPO 募资 265 亿美元,首日上涨 13%,HBM4 4 个月卖了 10 亿美元。',
  },
]

const FALLBACK_COMPARISON: ComparisonTable = {
  models: [
    { id: 'gemini-3-6-flash', name: 'Gemini 3.6 Flash', vendor: 'Google', highlight: '07-21 GA · 成本最低' },
    { id: 'qwen-3-8', name: 'Qwen3.8-Max', vendor: 'Alibaba', highlight: '2.4T 全模态开源旗舰' },
    { id: 'kimi-k3', name: 'Kimi K3', vendor: 'Moonshot', highlight: '2.8T 原生视觉理解' },
    { id: 'deepseek-v4', name: 'DeepSeek V4', vendor: 'DeepSeek', highlight: '峰谷定价 + DSpark' },
    { id: 'gpt-5-6', name: 'GPT-5.6', vendor: 'OpenAI', highlight: 'Sol 旗舰 Coding Index 80' },
  ],
  rows: [
    {
      label: '上下文窗口',
      values: {
        'gemini-3-6-flash': '1M',
        'qwen-3-8': '1M',
        'kimi-k3': '1M',
        'deepseek-v4': '128K',
        'gpt-5-6': '1.05M',
      },
    },
    {
      label: '最大输出',
      values: {
        'gemini-3-6-flash': '64K',
        'qwen-3-8': '32K',
        'kimi-k3': '32K',
        'deepseek-v4': '16K',
        'gpt-5-6': '128K',
      },
    },
    {
      label: '价格 (Input/Output)',
      values: {
        'gemini-3-6-flash': '$0.15 / $0.6',
        'qwen-3-8': '¥2 / ¥6',
        'kimi-k3': '开源',
        'deepseek-v4': '¥3-6 / ¥6-12',
        'gpt-5-6': '$5 / $30',
      },
    },
    {
      label: '核心亮点',
      values: {
        'gemini-3-6-flash': '知识截止 2026-03 · agent planning',
        'qwen-3-8': '全模态 · 对手 1/10 价格',
        'kimi-k3': '原生视觉理解',
        'deepseek-v4': 'DSpark 加速 85%',
        'gpt-5-6': 'Coding Index 80 分',
      },
    },
    {
      label: '发布时间',
      values: {
        'gemini-3-6-flash': '2026-07-21',
        'qwen-3-8': '2026-07-19',
        'kimi-k3': '2026-07-17',
        'deepseek-v4': '2026-07-17',
        'gpt-5-6': '2026-07-09',
      },
    },
  ],
}

interface ApiArticleRaw {
  id: string
  title: string
  summary?: string | null
  coverImage?: string | null
  authorName?: string | null
  categoryId?: string | null
  viewCount?: number
  publishedAt?: string | null
  isPinned?: boolean
}

interface ApiChannelRaw {
  id: string
  title: string
  intro?: string | null
  coverImage?: string | null
  lecturerName?: string | null
  categoryId?: string | null
  isLive: boolean
  viewCount: number
}

function safeApi<T>(url: string): Promise<T | null> {
  // server component 中 fetch 相对路径会失败(无 origin),需用绝对 URL
  const isServer = typeof window === 'undefined'
  const baseUrl = isServer ? (process.env.API_URL ?? 'http://localhost:8801') : ''
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`
  return fetchApi<T>(fullUrl)
    .then((r) => (r.success ? r.data : null))
    .catch(() => null)
}

export async function fetchAiNewsArticles(limit = 9): Promise<AiNewsArticle[]> {
  const qs = new URLSearchParams({ page: '1', pageSize: String(limit) })
  const data = await safeApi<{ list: ApiArticleRaw[] }>(`/api/news/articles?${qs.toString()}`)
  if (!data?.list || data.list.length === 0) {
    return FALLBACK_ARTICLES.slice(0, limit)
  }
  return data.list.map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary ?? '',
    coverImage: a.coverImage ?? '',
    authorName: a.authorName ?? 'AI 资讯',
    categoryName: 'AI 资讯',
    viewCount: a.viewCount ?? 0,
    publishedAt: a.publishedAt ?? new Date().toISOString(),
    isPinned: a.isPinned ?? false,
    source: 'api' as const,
  }))
}

export async function fetchAiLiveChannels(limit = 4): Promise<AiLiveChannel[]> {
  const qs = new URLSearchParams({ page: '1', pageSize: String(limit) })
  const data = await safeApi<{ list: ApiChannelRaw[] }>(`/api/live/channels?${qs.toString()}`)
  if (!data?.list || data.list.length === 0) {
    return FALLBACK_LIVE_CHANNELS.slice(0, limit)
  }
  return data.list.slice(0, limit).map((c) => ({
    id: c.id,
    title: c.title,
    intro: c.intro ?? '',
    coverImage: c.coverImage ?? '',
    lecturerName: c.lecturerName ?? 'AI 讲师',
    categoryName: 'AI 直播',
    isLive: c.isLive,
    viewCount: c.viewCount,
    source: 'api' as const,
  }))
}

export function getComparisonTable(): ComparisonTable {
  return FALLBACK_COMPARISON
}

export function getFundingItems(): AiFundingItem[] {
  return FALLBACK_FUNDING
}

// =============================================================================
// AI Feed 时间线(对接 /api/ai-feed/items,真实采集数据,aihot 风格)
// =============================================================================

/** AI 资讯时间线条目(对应 ai_feed_hot_item 表) */
export interface AiFeedTimelineItem {
  id: string
  sourceCode: string
  title: string
  summary: string | null
  url: string | null
  coverUrl: string | null
  author: string | null
  currentRank: number | null
  currentHot: number | null
  publishTime: string | null
  lastSeenAt: string
  llmCategory: string | null
  trendTag: string | null
  trendGrowthPct: number | null
  titleEn: string | null
  titleJa: string | null
  titleKo: string | null
}

interface ApiFeedItemRaw {
  id: string
  sourceCode: string
  title: string
  summary?: string | null
  url?: string | null
  coverUrl?: string | null
  author?: string | null
  currentRank?: number | null
  currentHot?: number | null
  publishTime?: string | null
  lastSeenAt: string
  llmCategory?: string | null
  trendTag?: string | null
  trendGrowthPct?: number | null
  titleEn?: string | null
  titleJa?: string | null
  titleKo?: string | null
}

/**
 * 拉取真实 AI 资讯时间线数据(对接 /api/ai-feed/items)。
 *
 * 后端 ai-feed-collect cron 每 6 小时全量采集 17 个国内外信源,
 * 落到 ai_feed_hot_item 表;此函数读取最新条目并按 lastSeenAt 倒序展示。
 *
 * @param pageSize 单页条数(默认 50)
 * @param source 可选 sourceCode 筛选
 * @param category 可选 llmCategory 筛选
 * @param keyword 可选标题关键词搜索(后端 ilike 模糊匹配)
 * @param page 页码(默认 1,用于加载更多)
 */
export async function fetchAiFeedItems(
  pageSize = 50,
  source?: string,
  category?: string,
  keyword?: string,
  page = 1,
): Promise<{ items: AiFeedTimelineItem[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  if (source) params.set('source', source)
  if (category) params.set('category', category)
  if (keyword) params.set('keyword', keyword)

  const data = await safeApi<{ list: ApiFeedItemRaw[]; total: number; page: number; pageSize: number }>(
    `/api/ai-feed/items?${params.toString()}`,
  )
  if (!data?.list) {
    return { items: [], total: 0, page, pageSize }
  }
  return {
    items: data.list.map((it) => ({
      id: it.id,
      sourceCode: it.sourceCode,
      title: it.title,
      summary: it.summary ?? null,
      url: it.url ?? null,
      coverUrl: it.coverUrl ?? null,
      author: it.author ?? null,
      currentRank: it.currentRank ?? null,
      currentHot: it.currentHot ?? null,
      publishTime: it.publishTime ?? null,
      lastSeenAt: it.lastSeenAt,
      llmCategory: it.llmCategory ?? null,
      trendTag: it.trendTag ?? null,
      trendGrowthPct: it.trendGrowthPct ?? null,
      titleEn: it.titleEn ?? null,
      titleJa: it.titleJa ?? null,
      titleKo: it.titleKo ?? null,
    })),
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  }
}

/** 趋势爆发通知条目(对接 /api/ai-feed/notifications) */
export interface TrendNotification {
  id: string
  title: string
  titleEn: string | null
  sourceCode: string
  trendGrowthPct: number
  currentHot: number
  lastSeenAt: string
  url: string | null
}

/**
 * 拉取趋势爆发通知(热度增长率 ≥ minGrowth% 的最近 hours 小时内条目)。
 *
 * 后端 /api/ai-feed/notifications 已实现,此函数为前端轮询入口。
 * 无数据时返回空数组(组件 return null 不渲染)。
 */
export async function fetchAiFeedNotifications(
  hours = 6,
  minGrowth = 50,
  limit = 5,
): Promise<TrendNotification[]> {
  const params = new URLSearchParams({
    hours: String(hours),
    minGrowth: String(minGrowth),
    limit: String(limit),
  })
  const data = await safeApi<{ list: TrendNotification[]; total: number }>(`/api/ai-feed/notifications?${params.toString()}`)
  return data?.list ?? []
}

// aihot API(权威 AI 资讯源,公开匿名可访,数据最新最准)
// 本地数据库 LLM 分类质量差(ithome 非 AI 内容被误分到 ai-models),不可靠,优先用 aihot
const AIHOT_API = 'https://aihot.virxact.com/api/public'
const AIHOT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

interface AihotItem {
  id: string
  title: string
  url: string
  source: string
  publishedAt: string | null
  summary: string | null
  category: string | null
}

export async function fetchAiFeedHot(
  limit = 10,
): Promise<Array<{ id: string; title: string; sourceCode: string; currentHot: number | null; currentRank: number | null; url: string | null; llmCategory: string | null }>> {
  // 1. 优先调用 aihot API(精选 AI 模型资讯,按发布时间倒序,最近 7 天)
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const url = `${AIHOT_API}/items?mode=selected&category=ai-models&since=${since}&take=${limit * 2}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': AIHOT_UA, Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      })
      if (res.ok) {
        const json = (await res.json()) as { items?: AihotItem[] }
        const items = (json.items ?? []).filter((it) => it.title && it.url)
        if (items.length > 0) {
          return items.slice(0, limit).map((it) => ({
            id: `aihot-${it.id}`,
            title: it.title,
            sourceCode: 'aihot',
            currentHot: null,
            currentRank: null,
            url: it.url,
            llmCategory: it.category,
          }))
        }
      }
    } finally {
      clearTimeout(timer)
    }
  } catch {
    // 静默 fallback 到本地数据库
  }

  // 2. Fallback:本地数据库 + category=ai-models 过滤 + 关键词二次过滤(排除 LLM 误分类的非 AI 内容)
  const params = new URLSearchParams({ page: '1', pageSize: String(limit * 5), category: 'ai-models' })
  const data = await safeApi<{ list: ApiFeedItemRaw[]; total: number }>(
    `/api/ai-feed/hot?${params.toString()}`,
  )
  if (!data?.list) return []
  // 排除明显非 AI 标题(电影/手机/汽车/微信/广告/法务/雷军等 LLM 误分类)
  const BLOCK_KEYWORDS = /电影|票房|手机|汽车|销量|运-20|微信|广告|雷军|小米|华为\s*Mate|REDMI|SU7|法务|博主被判|撞测试|澎程|油耗|功夫女足|周星驰|储能|NAS|麒麟\s*90|原神/i
  return data.list
    .filter((it) => !BLOCK_KEYWORDS.test(it.title))
    .map((it) => {
      const hot = it.currentHot ?? null
      const rank = it.currentRank ?? null
      const score = hot !== null && hot > 0 ? hot : rank !== null && rank > 0 ? 100000 - rank * 100 : 0
      return { it, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => ({
      id: x.it.id,
      title: x.it.title,
      sourceCode: x.it.sourceCode,
      currentHot: x.it.currentHot ?? null,
      currentRank: x.it.currentRank ?? null,
      url: x.it.url ?? null,
      llmCategory: x.it.llmCategory ?? null,
    }))
}

/** 趋势图表数据点(对应 ai_feed_snapshot 表某天的 rank/hotValue) */
export interface TrendChartPoint {
  snapshotDate: string
  rank: number | null
  hotValue: number | null
}

/** 趋势图表 API 返回(对接 /api/ai-feed/trends) */
export interface TrendChartData {
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

/**
 * 拉取单条资讯的趋势图表数据(7/14 天热度+排名曲线)。
 * 需 ≥2 天快照才有曲线数据(明天 cron 后自动有)。
 */
export async function fetchAiTrendChart(itemId: string, window = 14): Promise<TrendChartData | null> {
  const params = new URLSearchParams({ itemId, window: String(window) })
  const data = await safeApi<TrendChartData>(`/api/ai-feed/trends?${params.toString()}`)
  return data
}

/** 拉取启用的数据源列表(用于顶部 Tab 渲染) */
export async function fetchAiFeedSources(): Promise<
  Array<{
    id: string
    sourceCode: string
    sourceName: string
    category: string
    icon: string | null
    color: string | null
    sortOrder: number
  }>
> {
  const data = await safeApi<{ list: Array<{ id: string; sourceCode: string; sourceName: string; category: string; icon: string | null; color: string | null; sortOrder: number }> }>(
    '/api/ai-feed/sources?enabledOnly=true',
  )
  return data?.list ?? []
}

// =============================================================================
// 大模型排行榜(对接 /api/model-leaderboard,参考 arena.ai/leaderboard)
// =============================================================================

/** 模型分类(6 类 + agent + overall) */
export type LeaderboardCategory =
  | 'overall' | 'llm' | 'image' | 'video' | 'multimodal' | 'audio' | 'embedding' | 'agent'

/** 能力雷达图 5 维评分(0-100) */
export interface ModelCapabilities {
  coding: number
  math: number
  reasoning: number
  creative: number
  chinese: number
}

/** 排行榜条目(对应后端 model_leaderboard 表) */
export interface LeaderboardEntry {
  id: string
  modelId: string
  modelName: string
  vendor: string
  category: LeaderboardCategory
  subcategory: string | null
  arenaScore: number | null
  arenaRank: number | null
  rankDelta: number | null
  rankSpreadLow: number | null
  rankSpreadHigh: number | null
  scoreCi: number | null
  winRate: number | null
  voteCount: number | null
  contextWindow: string | null
  maxOutput: string | null
  inputPrice: string | null
  outputPrice: string | null
  releaseDate: string | null
  highlight: string | null
  capabilities: ModelCapabilities | null
  license: string
  isOverall: boolean
  sortOrder: number
}

/** 拉取排行榜(对接 /api/model-leaderboard?category=&subcategory=&limit=) */
export async function fetchLeaderboard(
  category: LeaderboardCategory = 'overall',
  subcategory?: string,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams({
    category,
    limit: String(limit),
  })
  if (subcategory) params.set('subcategory', subcategory)
  const data = await safeApi<{ list: LeaderboardEntry[]; total: number }>(
    `/api/model-leaderboard?${params.toString()}`,
  )
  return data?.list ?? []
}

/** 拉取单模型详情(对接 /api/model-leaderboard/:modelId) */
export async function fetchLeaderboardEntry(
  modelId: string,
): Promise<LeaderboardEntry | null> {
  const data = await safeApi<{ entry: LeaderboardEntry }>(
    `/api/model-leaderboard/${encodeURIComponent(modelId)}`,
  )
  return data?.entry ?? null
}

/**
 * 一次性拉取全部分类的排行榜条目(供 Leaderboard 客户端组件本地过滤)。
 *
 * 并行请求 8 个分类(overall/llm/image/video/multimodal/audio/embedding/agent),
 * llm 额外拉取 3 个子分类(general/coding/reasoning)。
 * 若 API 全部返回空 → 降级到 FALLBACK_LEADERBOARD(arena.ai 2026-07 真实数据子集)。
 */
export async function fetchAllLeaderboardEntries(): Promise<LeaderboardEntry[]> {
  const cats: Array<[LeaderboardCategory, string?]> = [
    ['overall'],
    ['llm', 'general'],
    ['llm', 'coding'],
    ['llm', 'reasoning'],
    ['image'],
    ['video'],
    ['multimodal'],
    ['audio'],
    ['embedding'],
    ['agent'],
  ]
  const results = await Promise.all(cats.map(([c, s]) => fetchLeaderboard(c, s, 30)))
  const merged = results.flat()
  if (merged.length > 0) return merged
  return FALLBACK_LEADERBOARD
}

/** Fallback:arena.ai 2026-07 真实数据子集(DB 未 seed 时降级使用) */
const FALLBACK_LEADERBOARD: LeaderboardEntry[] = [
  // 总榜(9)
  { id: 'fb-o1', modelId: 'claude-fable-5', modelName: 'Claude Fable 5', vendor: 'Anthropic', category: 'overall', subcategory: null, arenaScore: 1507, arenaRank: 1, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 7, winRate: null, voteCount: null, contextWindow: '1M', maxOutput: '128K', inputPrice: '$10', outputPrice: '$50', releaseDate: '2026-07-15', highlight: '总榜第一,LLM 通用冠军,综合能力全面领先', capabilities: { coding: 95, math: 90, reasoning: 94, creative: 88, chinese: 90 }, license: 'Proprietary', isOverall: true, sortOrder: 1 },
  { id: 'fb-o2', modelId: 'gpt-image-2-medium', modelName: 'GPT Image 2 Medium', vendor: 'OpenAI', category: 'overall', subcategory: null, arenaScore: 1500, arenaRank: 2, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 5, winRate: null, voteCount: null, contextWindow: null, maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: '总榜第二,生图冠军,归一化分 1500', capabilities: { coding: 35, math: 30, reasoning: 65, creative: 95, chinese: 70 }, license: 'Proprietary', isOverall: true, sortOrder: 2 },
  { id: 'fb-o3', modelId: 'gemini-omni-flash', modelName: 'Gemini Omni Flash', vendor: 'Google', category: 'overall', subcategory: null, arenaScore: 1527, arenaRank: 3, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 13, winRate: null, voteCount: 5449, contextWindow: null, maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: '总榜第三,视频生成冠军,运动一致性最佳', capabilities: { coding: 35, math: 30, reasoning: 60, creative: 94, chinese: 65 }, license: 'Proprietary', isOverall: true, sortOrder: 3 },
  { id: 'fb-o4', modelId: 'claude-fable-5-high', modelName: 'Claude Fable 5 High', vendor: 'Anthropic', category: 'overall', subcategory: null, arenaScore: 1394, arenaRank: 4, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 8, winRate: 13.94, voteCount: 16059, contextWindow: '1M', maxOutput: '128K', inputPrice: '$10', outputPrice: '$50', releaseDate: '2026-07-15', highlight: '总榜第四,Agent 冠军,净提升 13.94%', capabilities: { coding: 95, math: 82, reasoning: 94, creative: 78, chinese: 85 }, license: 'Proprietary', isOverall: true, sortOrder: 4 },
  { id: 'fb-o5', modelId: 'claude-opus-4-6-thinking', modelName: 'Claude Opus 4.6 Thinking', vendor: 'Anthropic', category: 'overall', subcategory: null, arenaScore: 1504, arenaRank: 5, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 4, winRate: null, voteCount: null, contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25', releaseDate: '2026-07-10', highlight: '总榜第五,LLM 通用亚军,深度推理强项', capabilities: { coding: 93, math: 92, reasoning: 95, creative: 84, chinese: 88 }, license: 'Proprietary', isOverall: true, sortOrder: 5 },
  { id: 'fb-o6', modelId: 'dreamina-seedance-2-0-720p', modelName: 'Dreamina Seedance 2.0 720p', vendor: 'Bytedance', category: 'overall', subcategory: null, arenaScore: 1482, arenaRank: 6, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 10, winRate: null, voteCount: 41953, contextWindow: null, maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: '总榜第六,视频亚军,国产视频第一', capabilities: { coding: 32, math: 28, reasoning: 58, creative: 92, chinese: 75 }, license: 'Proprietary', isOverall: true, sortOrder: 6 },
  { id: 'fb-o7', modelId: 'eleven-multilingual-v2', modelName: 'Eleven Multilingual v2', vendor: 'ElevenLabs', category: 'overall', subcategory: null, arenaScore: 1420, arenaRank: 7, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 6, winRate: null, voteCount: 50000, contextWindow: null, maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: '总榜第七,语音冠军,多语言自然度顶尖', capabilities: { coding: 30, math: 28, reasoning: 35, creative: 90, chinese: 60 }, license: 'Proprietary', isOverall: true, sortOrder: 7 },
  { id: 'fb-o8', modelId: 'text-embedding-3-large', modelName: 'Text Embedding 3 Large', vendor: 'OpenAI', category: 'overall', subcategory: null, arenaScore: 1450, arenaRank: 8, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 5, winRate: null, voteCount: null, contextWindow: '8K', maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: '总榜第八,嵌入冠军,8192 维检索精度最高', capabilities: { coding: 65, math: 72, reasoning: 68, creative: 60, chinese: 65 }, license: 'Proprietary', isOverall: true, sortOrder: 8 },
  { id: 'fb-o9', modelId: 'claude-opus-4-7-thinking', modelName: 'Claude Opus 4.7 Thinking', vendor: 'Anthropic', category: 'overall', subcategory: null, arenaScore: 1503, arenaRank: 9, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 4, winRate: null, voteCount: null, contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25', releaseDate: '2026-07-12', highlight: '总榜第九,Opus 4.6 升级版,推理能力进一步提升', capabilities: { coding: 94, math: 91, reasoning: 95, creative: 85, chinese: 89 }, license: 'Proprietary', isOverall: true, sortOrder: 9 },
  // LLM 通用(3)
  { id: 'fb-lg1', modelId: 'claude-fable-5', modelName: 'Claude Fable 5', vendor: 'Anthropic', category: 'llm', subcategory: 'general', arenaScore: 1507, arenaRank: 1, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 7, winRate: null, voteCount: null, contextWindow: '1M', maxOutput: '128K', inputPrice: '$10', outputPrice: '$50', releaseDate: '2026-07-15', highlight: 'Anthropic 旗舰模型,综合能力全面领先', capabilities: { coding: 95, math: 90, reasoning: 94, creative: 88, chinese: 90 }, license: 'Proprietary', isOverall: false, sortOrder: 1 },
  { id: 'fb-lg2', modelId: 'claude-opus-4-6-thinking', modelName: 'Claude Opus 4.6 Thinking', vendor: 'Anthropic', category: 'llm', subcategory: 'general', arenaScore: 1504, arenaRank: 2, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 4, winRate: null, voteCount: null, contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25', releaseDate: '2026-07-10', highlight: '深度推理强项,数学与代码表现突出', capabilities: { coding: 93, math: 92, reasoning: 95, creative: 84, chinese: 88 }, license: 'Proprietary', isOverall: false, sortOrder: 2 },
  { id: 'fb-lg3', modelId: 'kimi-k3', modelName: 'Kimi K3', vendor: 'Moonshot', category: 'llm', subcategory: 'general', arenaScore: 1486, arenaRank: 9, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 11, winRate: null, voteCount: null, contextWindow: '1M', maxOutput: null, inputPrice: '开源', outputPrice: '开源', releaseDate: '2026-07-17', highlight: '月之暗面 2.8 万亿参数开源模型,国产之光', capabilities: { coding: 88, math: 85, reasoning: 87, creative: 86, chinese: 93 }, license: '开源', isOverall: false, sortOrder: 9 },
  // LLM 代码(3)
  { id: 'fb-lc1', modelId: 'claude-opus-4-7-thinking#coding', modelName: 'Claude Opus 4.7 Thinking', vendor: 'Anthropic', category: 'llm', subcategory: 'coding', arenaScore: 1567, arenaRank: 1, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 5, winRate: null, voteCount: null, contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25', releaseDate: '2026-07-12', highlight: 'WebDev Arena 编程榜首,全栈开发能力最强', capabilities: { coding: 98, math: 90, reasoning: 95, creative: 80, chinese: 85 }, license: 'Proprietary', isOverall: false, sortOrder: 11 },
  { id: 'fb-lc2', modelId: 'qwen3-7-max#coding', modelName: 'Qwen3.7 Max', vendor: 'Alibaba', category: 'llm', subcategory: 'coding', arenaScore: 1537, arenaRank: 7, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 7, winRate: null, voteCount: null, contextWindow: '1M', maxOutput: null, inputPrice: '¥2', outputPrice: '¥6', releaseDate: null, highlight: '阿里通义千问编程特化,国产编程第一', capabilities: { coding: 94, math: 88, reasoning: 87, creative: 78, chinese: 92 }, license: 'Proprietary', isOverall: false, sortOrder: 17 },
  { id: 'fb-lc3', modelId: 'glm-5-1#coding', modelName: 'GLM-5.1', vendor: 'Z.ai', category: 'llm', subcategory: 'coding', arenaScore: 1532, arenaRank: 8, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 8, winRate: null, voteCount: null, contextWindow: '128K', maxOutput: null, inputPrice: '¥3', outputPrice: '¥6', releaseDate: null, highlight: '智谱 GLM 编程版,中文代码注释优秀', capabilities: { coding: 92, math: 85, reasoning: 86, creative: 76, chinese: 94 }, license: 'Proprietary', isOverall: false, sortOrder: 18 },
  // LLM 推理(3)
  { id: 'fb-lr1', modelId: 'claude-fable-5#reasoning', modelName: 'Claude Fable 5', vendor: 'Anthropic', category: 'llm', subcategory: 'reasoning', arenaScore: 1500, arenaRank: 1, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 8, winRate: null, voteCount: null, contextWindow: '1M', maxOutput: '128K', inputPrice: '$10', outputPrice: '$50', releaseDate: '2026-07-15', highlight: '复杂推理与多步规划能力顶尖', capabilities: { coding: 92, math: 93, reasoning: 96, creative: 85, chinese: 89 }, license: 'Proprietary', isOverall: false, sortOrder: 21 },
  { id: 'fb-lr2', modelId: 'kimi-k3#reasoning', modelName: 'Kimi K3', vendor: 'Moonshot', category: 'llm', subcategory: 'reasoning', arenaScore: 1478, arenaRank: 9, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 12, winRate: null, voteCount: null, contextWindow: '1M', maxOutput: null, inputPrice: '开源', outputPrice: '开源', releaseDate: '2026-07-17', highlight: '国产开源推理旗舰,中文推理优秀', capabilities: { coding: 86, math: 87, reasoning: 89, creative: 84, chinese: 92 }, license: '开源', isOverall: false, sortOrder: 29 },
  { id: 'fb-lr3', modelId: 'gpt-5-6-sol-xhigh#reasoning', modelName: 'GPT-5.6 Sol xHigh', vendor: 'OpenAI', category: 'llm', subcategory: 'reasoning', arenaScore: 1478, arenaRank: 10, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 10, winRate: null, voteCount: null, contextWindow: '1.05M', maxOutput: '128K', inputPrice: '$5', outputPrice: '$30', releaseDate: '2026-07-09', highlight: 'OpenAI 推理模式,数学竞赛级表现', capabilities: { coding: 90, math: 90, reasoning: 91, creative: 81, chinese: 82 }, license: 'Proprietary', isOverall: false, sortOrder: 30 },
  // 生图(3)
  { id: 'fb-im1', modelId: 'gpt-image-2-medium', modelName: 'GPT Image 2 Medium', vendor: 'OpenAI', category: 'image', subcategory: null, arenaScore: 1385, arenaRank: 1, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 5, winRate: null, voteCount: null, contextWindow: null, maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: 'OpenAI 旗舰生图,细节还原与文字渲染顶尖', capabilities: { coding: 35, math: 30, reasoning: 65, creative: 95, chinese: 70 }, license: 'Proprietary', isOverall: false, sortOrder: 31 },
  { id: 'fb-im2', modelId: 'reve-2-1', modelName: 'Reve 2.1', vendor: 'Reve', category: 'image', subcategory: null, arenaScore: 1302, arenaRank: 2, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 12, winRate: null, voteCount: null, contextWindow: null, maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: '新兴生图黑马,风格化表现突出', capabilities: { coding: 32, math: 28, reasoning: 62, creative: 92, chinese: 68 }, license: 'Proprietary', isOverall: false, sortOrder: 32 },
  { id: 'fb-im3', modelId: 'muse-image', modelName: 'Muse Image', vendor: 'Meta', category: 'image', subcategory: null, arenaScore: 1280, arenaRank: 3, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 8, winRate: null, voteCount: null, contextWindow: null, maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: 'Meta 开源生图,编辑能力灵活', capabilities: { coding: 34, math: 29, reasoning: 63, creative: 90, chinese: 66 }, license: '开源', isOverall: false, sortOrder: 33 },
  // 视频(3)
  { id: 'fb-vi1', modelId: 'gemini-omni-flash', modelName: 'Gemini Omni Flash', vendor: 'Google', category: 'video', subcategory: null, arenaScore: 1527, arenaRank: 1, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 13, winRate: null, voteCount: 5449, contextWindow: null, maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: 'Google 全能视频生成,运动一致性最佳', capabilities: { coding: 35, math: 30, reasoning: 60, creative: 94, chinese: 65 }, license: 'Proprietary', isOverall: false, sortOrder: 41 },
  { id: 'fb-vi2', modelId: 'dreamina-seedance-2-0-720p', modelName: 'Dreamina Seedance 2.0 720p', vendor: 'Bytedance', category: 'video', subcategory: null, arenaScore: 1482, arenaRank: 2, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 10, winRate: null, voteCount: 41953, contextWindow: null, maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: '字节梦境 2.0,国产视频第一,720p 画质', capabilities: { coding: 32, math: 28, reasoning: 58, creative: 92, chinese: 75 }, license: 'Proprietary', isOverall: false, sortOrder: 42 },
  { id: 'fb-vi3', modelId: 'sora-2-pro', modelName: 'Sora 2 Pro', vendor: 'OpenAI', category: 'video', subcategory: null, arenaScore: 1366, arenaRank: 5, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 8, winRate: null, voteCount: 39773, contextWindow: null, maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: 'OpenAI 视频旗舰,物理模拟逼真', capabilities: { coding: 36, math: 32, reasoning: 62, creative: 93, chinese: 66 }, license: 'Proprietary', isOverall: false, sortOrder: 45 },
  // 多模态(3)
  { id: 'fb-mm1', modelId: 'claude-fable-5', modelName: 'Claude Fable 5', vendor: 'Anthropic', category: 'multimodal', subcategory: null, arenaScore: 1318, arenaRank: 1, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 9, winRate: null, voteCount: 7411, contextWindow: '1M', maxOutput: '128K', inputPrice: '$10', outputPrice: '$50', releaseDate: '2026-07-15', highlight: '视觉理解+推理双强,图表分析顶尖', capabilities: { coding: 90, math: 85, reasoning: 92, creative: 85, chinese: 88 }, license: 'Proprietary', isOverall: false, sortOrder: 51 },
  { id: 'fb-mm2', modelId: 'gemini-3-pro', modelName: 'Gemini 3 Pro', vendor: 'Google', category: 'multimodal', subcategory: null, arenaScore: 1289, arenaRank: 7, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 8, winRate: null, voteCount: 13183, contextWindow: '1M', maxOutput: '128K', inputPrice: '$2', outputPrice: '$12', releaseDate: '2026-07-17', highlight: '原生多模态,视频理解能力强', capabilities: { coding: 86, math: 88, reasoning: 88, creative: 83, chinese: 84 }, license: 'Proprietary', isOverall: false, sortOrder: 57 },
  { id: 'fb-mm3', modelId: 'gpt-5-5', modelName: 'GPT-5.5', vendor: 'OpenAI', category: 'multimodal', subcategory: null, arenaScore: 1286, arenaRank: 9, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 7, winRate: null, voteCount: 17412, contextWindow: '1.1M', maxOutput: '128K', inputPrice: '$5', outputPrice: '$30', releaseDate: null, highlight: 'OpenAI 多模态旗舰,图文混合理解强', capabilities: { coding: 87, math: 86, reasoning: 87, creative: 82, chinese: 83 }, license: 'Proprietary', isOverall: false, sortOrder: 59 },
  // Agent(3)
  { id: 'fb-ag1', modelId: 'claude-fable-5-high', modelName: 'Claude Fable 5 High', vendor: 'Anthropic', category: 'agent', subcategory: null, arenaScore: 1394, arenaRank: 1, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 8, winRate: 13.94, voteCount: 16059, contextWindow: '1M', maxOutput: '128K', inputPrice: '$10', outputPrice: '$50', releaseDate: '2026-07-15', highlight: 'Agent 净提升 13.94% 居首,复杂任务规划最强', capabilities: { coding: 95, math: 82, reasoning: 94, creative: 78, chinese: 85 }, license: 'Proprietary', isOverall: false, sortOrder: 61 },
  { id: 'fb-ag2', modelId: 'gpt-5-6-sol-xhigh', modelName: 'GPT-5.6 Sol xHigh', vendor: 'OpenAI', category: 'agent', subcategory: null, arenaScore: 1094, arenaRank: 2, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 9, winRate: 10.94, voteCount: 7881, contextWindow: '1.05M', maxOutput: '128K', inputPrice: '$5', outputPrice: '$30', releaseDate: '2026-07-09', highlight: 'Agent 净提升 10.94%,代码任务自动化出色', capabilities: { coding: 93, math: 80, reasoning: 90, creative: 72, chinese: 80 }, license: 'Proprietary', isOverall: false, sortOrder: 62 },
  { id: 'fb-ag3', modelId: 'glm-5-2-max', modelName: 'GLM-5.2 Max', vendor: 'Z.ai', category: 'agent', subcategory: null, arenaScore: 624, arenaRank: 9, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 10, winRate: 6.24, voteCount: null, contextWindow: '128K', maxOutput: null, inputPrice: '¥3', outputPrice: '¥6', releaseDate: null, highlight: '国产 Agent 第一,净提升 6.24%', capabilities: { coding: 86, math: 75, reasoning: 85, creative: 72, chinese: 90 }, license: 'Proprietary', isOverall: false, sortOrder: 69 },
  // 语音(2)
  { id: 'fb-au1', modelId: 'eleven-multilingual-v2', modelName: 'Eleven Multilingual v2', vendor: 'ElevenLabs', category: 'audio', subcategory: null, arenaScore: 1420, arenaRank: 1, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 6, winRate: null, voteCount: 50000, contextWindow: null, maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: 'ElevenLabs 旗舰,多语言语音自然度顶尖', capabilities: { coding: 30, math: 28, reasoning: 35, creative: 90, chinese: 60 }, license: 'Proprietary', isOverall: false, sortOrder: 71 },
  { id: 'fb-au2', modelId: 'minimax-voice', modelName: 'MiniMax Voice', vendor: 'MiniMax', category: 'audio', subcategory: null, arenaScore: 1350, arenaRank: 5, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 8, winRate: null, voteCount: 25000, contextWindow: null, maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: '国产语音合成,中文拟真度高', capabilities: { coding: 30, math: 28, reasoning: 35, creative: 85, chinese: 88 }, license: 'Proprietary', isOverall: false, sortOrder: 75 },
  // 嵌入(2)
  { id: 'fb-em1', modelId: 'text-embedding-3-large', modelName: 'Text Embedding 3 Large', vendor: 'OpenAI', category: 'embedding', subcategory: null, arenaScore: 1450, arenaRank: 1, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 5, winRate: null, voteCount: null, contextWindow: '8K', maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: 'OpenAI 旗舰嵌入,8192 维,检索精度最高', capabilities: { coding: 65, math: 72, reasoning: 68, creative: 60, chinese: 65 }, license: 'Proprietary', isOverall: false, sortOrder: 76 },
  { id: 'fb-em2', modelId: 'bge-m3', modelName: 'BGE-M3', vendor: 'BAAI', category: 'embedding', subcategory: null, arenaScore: 1390, arenaRank: 4, rankDelta: null, rankSpreadLow: null, rankSpreadHigh: null, scoreCi: 8, winRate: null, voteCount: null, contextWindow: null, maxOutput: null, inputPrice: null, outputPrice: null, releaseDate: null, highlight: '智源开源嵌入,多语言+长文本', capabilities: { coding: 63, math: 67, reasoning: 64, creative: 56, chinese: 72 }, license: '开源', isOverall: false, sortOrder: 79 },
]
