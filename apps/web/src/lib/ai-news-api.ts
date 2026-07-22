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
  const baseUrl = isServer ? (process.env.API_URL ?? 'http://localhost:3001') : ''
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
    })),
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  }
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
