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
    {
      id: 'gpt-5-6',
      name: 'GPT-5.6',
      vendor: 'OpenAI',
      highlight: 'Sol 旗舰 / Terra 均衡 / Luna 轻量',
    },
    { id: 'gemini-3-5', name: 'Gemini 3.5 Pro', vendor: 'Google', highlight: '前端代码生成王者' },
    {
      id: 'claude-sonnet-5',
      name: 'Claude Sonnet 5',
      vendor: 'Anthropic',
      highlight: '智能体能力最强',
    },
    { id: 'kimi-k3', name: 'Kimi K3', vendor: 'Moonshot', highlight: '2.8 万亿开源' },
    { id: 'deepseek-v4', name: 'DeepSeek V4', vendor: 'DeepSeek', highlight: '峰谷定价 + DSpark' },
  ],
  rows: [
    {
      label: '上下文窗口',
      values: {
        'gpt-5-6': '1.05M',
        'gemini-3-5': '2M',
        'claude-sonnet-5': '1M',
        'kimi-k3': '1M',
        'deepseek-v4': '128K',
      },
    },
    {
      label: '最大输出',
      values: {
        'gpt-5-6': '128K',
        'gemini-3-5': '64K',
        'claude-sonnet-5': '64K',
        'kimi-k3': '32K',
        'deepseek-v4': '16K',
      },
    },
    {
      label: '价格 (Input/Output)',
      values: {
        'gpt-5-6': '$5 / $30',
        'gemini-3-5': '$3 / $12',
        'claude-sonnet-5': '$3 / $15',
        'kimi-k3': '开源',
        'deepseek-v4': '¥3-6 / ¥6-12',
      },
    },
    {
      label: '核心亮点',
      values: {
        'gpt-5-6': 'Coding Index 80 分',
        'gemini-3-5': 'SVG 一次生成',
        'claude-sonnet-5': 'BrowseComp / OSWorld',
        'kimi-k3': '原生视觉理解',
        'deepseek-v4': 'DSpark 加速 85%',
      },
    },
    {
      label: '发布时间',
      values: {
        'gpt-5-6': '2026-07-09',
        'gemini-3-5': '2026-07-17',
        'claude-sonnet-5': '2026-07-01',
        'kimi-k3': '2026-07-17',
        'deepseek-v4': '2026-07-17',
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
  return fetchApi<T>(url)
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
 */
export async function fetchAiFeedItems(
  pageSize = 50,
  source?: string,
  category?: string,
): Promise<{ items: AiFeedTimelineItem[]; total: number }> {
  const params = new URLSearchParams({
    page: '1',
    pageSize: String(pageSize),
  })
  if (source) params.set('source', source)
  if (category) params.set('category', category)

  const data = await safeApi<{ list: ApiFeedItemRaw[]; total: number }>(
    `/api/ai-feed/items?${params.toString()}`,
  )
  if (!data?.list) {
    return { items: [], total: 0 }
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
  }
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
