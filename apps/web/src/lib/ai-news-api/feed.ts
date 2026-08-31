// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { safeApi } from './http'
import type { AiFeedTimelineItem, TrendNotification } from './types'

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

  const data = await safeApi<{
    list: ApiFeedItemRaw[]
    total: number
    page: number
    pageSize: number
  }>(`/api/ai-feed/items?${params.toString()}`)
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
  const data = await safeApi<{ list: TrendNotification[]; total: number }>(
    `/api/ai-feed/notifications?${params.toString()}`,
  )
  return data?.list ?? []
}

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

export async function fetchAiFeedHot(limit = 10): Promise<
  Array<{
    id: string
    title: string
    sourceCode: string
    currentHot: number | null
    currentRank: number | null
    url: string | null
    llmCategory: string | null
  }>
> {
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
  const params = new URLSearchParams({
    page: '1',
    pageSize: String(limit * 5),
    category: 'ai-models',
  })
  const data = await safeApi<{ list: ApiFeedItemRaw[]; total: number }>(
    `/api/ai-feed/hot?${params.toString()}`,
  )
  if (!data?.list) return []
  // 排除明显非 AI 标题(电影/手机/汽车/微信/广告/法务/雷军等 LLM 误分类)
  const BLOCK_KEYWORDS =
    /电影|票房|手机|汽车|销量|运-20|微信|广告|雷军|小米|华为\s*Mate|REDMI|SU7|法务|博主被判|撞测试|澎程|油耗|功夫女足|周星驰|储能|NAS|麒麟\s*90|原神/i
  return data.list
    .filter((it) => !BLOCK_KEYWORDS.test(it.title))
    .map((it) => {
      const hot = it.currentHot ?? null
      const rank = it.currentRank ?? null
      const score =
        hot !== null && hot > 0 ? hot : rank !== null && rank > 0 ? 100000 - rank * 100 : 0
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
  const data = await safeApi<{
    list: Array<{
      id: string
      sourceCode: string
      sourceName: string
      category: string
      icon: string | null
      color: string | null
      sortOrder: number
    }>
  }>('/api/ai-feed/sources?enabledOnly=true')
  return data?.list ?? []
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
