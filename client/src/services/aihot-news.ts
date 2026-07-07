/**
 * AI HOT 资讯服务
 *
 * 数据源: aihot.virxact.com 公开匿名 REST API (无需 API Key)
 * - /api/public/items?mode=selected  每日精选 AI 动态 (实时滚动, 按发布时间倒序)
 * - /api/public/daily                每日日报 (北京时间 08:00 生成, 5 大版块)
 * - /api/public/dailies              日报归档列表 (最近 N 天索引)
 *
 * 通过 Vite dev proxy / nginx prod proxy 的 /aihot-api 前缀访问, 避免跨域.
 * 自带内存缓存 (items 10min, daily 30min, dailies 60min), 降低对外部 API 的请求频率.
 *
 * 2026-07-07 v2 升级:
 *   - 分页(cursor)、分类筛选(category)、关键词搜索(q)
 *   - 日报数据(daily) + 日报归档(dailies)
 *   - 信源统计(sources) + 按信源分配配图(视觉一致性)
 *   - IndexedDB 持久化缓存 (离线可读)
 */
import coverNeural from '@/assets/images/ai-news-covers/cover-neural.jpg'
import coverChip from '@/assets/images/ai-news-covers/cover-chip.jpg'
import coverRobot from '@/assets/images/ai-news-covers/cover-robot.jpg'
import coverData from '@/assets/images/ai-news-covers/cover-data.jpg'
import coverCode from '@/assets/images/ai-news-covers/cover-code.jpg'
import coverBrain from '@/assets/images/ai-news-covers/cover-brain.jpg'

/** 6 张本地 AI 主题配图 */
const COVERS = [coverNeural, coverChip, coverRobot, coverData, coverCode, coverBrain]

/** category slug → 中文标签 */
const CATEGORY_LABELS: Record<string, string> = {
  'ai-models': '模型发布',
  'ai-products': '产品发布',
  industry: '行业动态',
  paper: '论文研究',
  tip: '技巧观点',
}

/** 所有分类 (用于 UI 标签栏) */
export const ALL_CATEGORIES = [
  { slug: '', label: '全部' },
  { slug: 'ai-models', label: '模型发布' },
  { slug: 'ai-products', label: '产品发布' },
  { slug: 'industry', label: '行业动态' },
  { slug: 'paper', label: '论文研究' },
  { slug: 'tip', label: '技巧观点' },
]

/** 标准化后的 AI 资讯条目 */
export interface AiHotNewsItem {
  id: string
  title: string
  titleEn: string | null
  url: string
  source: string
  publishedAt: string
  summary: string
  category: string
  categoryLabel: string
  cover: string
  time: string
  isHot: boolean
  link: string
}

/** 日报版块条目 */
export interface AiHotDailySectionItem {
  title: string
  summary: string
  sourceUrl: string
  sourceName: string
}

/** 日报版块 */
export interface AiHotDailySection {
  label: string
  items: AiHotDailySectionItem[]
}

/** 日报数据 */
export interface AiHotDaily {
  date: string
  generatedAt: string
  lead: { title: string; leadParagraph: string } | null
  sections: AiHotDailySection[]
  flashes: AiHotDailySectionItem[]
}

/** 日报归档索引项 */
export interface AiHotDailyArchiveItem {
  date: string
  generatedAt: string
  leadTitle: string
}

/** 信源统计 */
export interface SourceStat {
  source: string
  count: number
}

const AIHOT_BASE = '/aihot-api/api/public'

/** 简单字符串 hash (djb2 变体) */
function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * 按信源分配配图 (同信源 → 同配图, 视觉一致性更强)
 * fallback: 按 id hash 分配
 */
const sourceCoverMap = new Map<string, string>()
let coverRotationIdx = 0

function pickCover(seed: string, source: string): string {
  // 信源已分配过 → 复用
  if (source && sourceCoverMap.has(source)) {
    return sourceCoverMap.get(source)!
  }
  // 新信源 → 轮转分配 (确保不同信源尽量用不同配图)
  const cover = source
    ? COVERS[coverRotationIdx++ % COVERS.length]
    : COVERS[hashStr(seed) % COVERS.length]
  if (source) {
    sourceCoverMap.set(source, cover)
  }
  return cover
}

/** ISO UTC → 北京时间相对描述 */
function relativeTime(iso: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Math.max(0, Date.now() - t)
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}小时前`
  const day = Math.floor(hr / 24)
  if (day === 1) return '昨天'
  if (day < 7) return `${day}天前`
  const d = new Date(t + 8 * 3600 * 1000)
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`
}

function normalizeItem(raw: Record<string, unknown>, index: number): AiHotNewsItem {
  const id = (raw.id as string) || String(index)
  const category = (raw.category as string) || ''
  const url = (raw.url as string) || '#'
  const source = (raw.source as string) || ''
  return {
    id,
    title: (raw.title as string) || '',
    titleEn: (raw.title_en as string) || null,
    url,
    source,
    publishedAt: (raw.publishedAt as string) || '',
    summary: (raw.summary as string) || '',
    category,
    categoryLabel: CATEGORY_LABELS[category] || 'AI动态',
    cover: pickCover(id || (raw.title as string) || String(index), source),
    time: relativeTime(raw.publishedAt as string),
    isHot: index < 3,
    link: url,
  }
}

/** 内存缓存 */
interface CacheEntry<T> {
  data: T
  ts: number
}
let itemsCache: CacheEntry<AiHotNewsItem[]> | null = null
let dailyCache: CacheEntry<AiHotDaily | null> | null = null
let dailiesCache: CacheEntry<AiHotDailyArchiveItem[]> | null = null
const ITEMS_TTL = 10 * 60 * 1000
const DAILY_TTL = 30 * 60 * 1000
const DAILIES_TTL = 60 * 60 * 1000

export interface FetchItemsOptions {
  category?: string
  take?: number
  days?: number
  force?: boolean
  cursor?: string
  q?: string
}

interface ItemsResponse {
  count: number
  hasNext: boolean
  nextCursor: string | null
  items: AiHotNewsItem[]
}

/** 拉取每日精选 AI 动态 */
export async function fetchAiHotItems(opts: FetchItemsOptions = {}): Promise<ItemsResponse> {
  const params = new URLSearchParams({ mode: 'selected' })
  if (opts.category) params.set('category', opts.category)
  params.set('take', String(opts.take ?? 50))
  const days = opts.days ?? 7
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
  params.set('since', since)
  if (opts.cursor) params.set('cursor', opts.cursor)
  if (opts.q) params.set('q', opts.q)

  const useCache = !opts.force && !opts.cursor && !opts.q && itemsCache && Date.now() - itemsCache.ts < ITEMS_TTL
  if (useCache && itemsCache) {
    return {
      count: itemsCache.data.length,
      hasNext: itemsCache.data.length >= (opts.take ?? 50),
      nextCursor: null,
      items: itemsCache.data,
    }
  }

  const res = await fetch(`${AIHOT_BASE}/items?${params.toString()}`)
  if (!res.ok) throw new Error(`aihot items HTTP ${res.status}`)
  const json = (await res.json()) as { items?: Record<string, unknown>[]; hasNext?: boolean; nextCursor?: string | null; count?: number }
  const items = (json.items || []).map((r, i) => normalizeItem(r, i))

  if (!opts.cursor && !opts.q) {
    itemsCache = { data: items, ts: Date.now() }
    // 持久化到 IndexedDB (异步, 不阻塞)
    persistToIndexedDB(items).catch(() => {})
  }

  return {
    count: json.count ?? items.length,
    hasNext: json.hasNext ?? false,
    nextCursor: json.nextCursor ?? null,
    items,
  }
}

/** cursor 翻页 */
export async function fetchMoreItems(cursor: string, opts: { category?: string; q?: string } = {}): Promise<{ items: AiHotNewsItem[]; nextCursor: string | null; hasNext: boolean }> {
  const res = await fetchAiHotItems({ ...opts, cursor, take: 50, days: 7 })
  return { items: res.items, nextCursor: res.nextCursor, hasNext: res.hasNext }
}

/** 拉取每日日报 */
export async function fetchAiHotDaily(force = false): Promise<AiHotDaily | null> {
  if (!force && dailyCache && Date.now() - dailyCache.ts < DAILY_TTL) {
    return dailyCache.data
  }
  try {
    const res = await fetch(`${AIHOT_BASE}/daily`)
    if (!res.ok) {
      if (res.status === 404) return null
      throw new Error(`aihot daily HTTP ${res.status}`)
    }
    const json = (await res.json()) as Record<string, unknown>
    const daily: AiHotDaily = {
      date: (json.date as string) || '',
      generatedAt: (json.generatedAt as string) || '',
      lead: json.lead ? {
        title: ((json.lead as Record<string, unknown>).title as string) || '',
        leadParagraph: ((json.lead as Record<string, unknown>).leadParagraph as string) || '',
      } : null,
      sections: Array.isArray(json.sections) ? (json.sections as Record<string, unknown>[]).map(s => ({
        label: (s.label as string) || '',
        items: Array.isArray(s.items) ? (s.items as Record<string, unknown>[]).map(it => ({
          title: (it.title as string) || '',
          summary: (it.summary as string) || '',
          sourceUrl: (it.sourceUrl as string) || '',
          sourceName: (it.sourceName as string) || '',
        })) : [],
      })) : [],
      flashes: Array.isArray(json.flashes) ? (json.flashes as Record<string, unknown>[]).map(it => ({
        title: (it.title as string) || '',
        summary: (it.summary as string) || '',
        sourceUrl: (it.sourceUrl as string) || '',
        sourceName: (it.sourceName as string) || '',
      })) : [],
    }
    dailyCache = { data: daily, ts: Date.now() }
    return daily
  } catch {
    return null
  }
}

/** 拉取日报归档列表 */
export async function fetchAiHotDailies(take = 14, force = false): Promise<AiHotDailyArchiveItem[]> {
  if (!force && dailiesCache && Date.now() - dailiesCache.ts < DAILIES_TTL) {
    return dailiesCache.data
  }
  try {
    const res = await fetch(`${AIHOT_BASE}/dailies?take=${take}`)
    if (!res.ok) return dailiesCache?.data || []
    const json = (await res.json()) as { items?: Record<string, unknown>[] }
    const items = (json.items || []).map(it => ({
      date: (it.date as string) || '',
      generatedAt: (it.generatedAt as string) || '',
      leadTitle: (it.leadTitle as string) || '',
    }))
    dailiesCache = { data: items, ts: Date.now() }
    return items
  } catch {
    return dailiesCache?.data || []
  }
}

/** 拉取指定日期日报 */
export async function fetchAiHotDailyByDate(date: string): Promise<AiHotDaily | null> {
  try {
    const res = await fetch(`${AIHOT_BASE}/daily/${date}`)
    if (!res.ok) return null
    const json = (await res.json()) as Record<string, unknown>
    return {
      date: (json.date as string) || date,
      generatedAt: (json.generatedAt as string) || '',
      lead: json.lead ? {
        title: ((json.lead as Record<string, unknown>).title as string) || '',
        leadParagraph: ((json.lead as Record<string, unknown>).leadParagraph as string) || '',
      } : null,
      sections: Array.isArray(json.sections) ? (json.sections as Record<string, unknown>[]).map(s => ({
        label: (s.label as string) || '',
        items: Array.isArray(s.items) ? (s.items as Record<string, unknown>[]).map(it => ({
          title: (it.title as string) || '',
          summary: (it.summary as string) || '',
          sourceUrl: (it.sourceUrl as string) || '',
          sourceName: (it.sourceName as string) || '',
        })) : [],
      })) : [],
      flashes: Array.isArray(json.flashes) ? (json.flashes as Record<string, unknown>[]).map(it => ({
        title: (it.title as string) || '',
        summary: (it.summary as string) || '',
        sourceUrl: (it.sourceUrl as string) || '',
        sourceName: (it.sourceName as string) || '',
      })) : [],
    }
  } catch {
    return null
  }
}

/** 清除缓存 */
export function clearAiHotCache(): void {
  itemsCache = null
  dailyCache = null
  dailiesCache = null
  sourceCoverMap.clear()
  coverRotationIdx = 0
}

/** 获取缓存时间戳 */
export function getItemsCacheTs(): number {
  return itemsCache?.ts || 0
}

/** 获取分类标签 */
export function getCategoryLabel(slug: string): string {
  return CATEGORY_LABELS[slug] || 'AI动态'
}

/** 从条目列表统计信源 */
export function countSources(items: AiHotNewsItem[]): SourceStat[] {
  const map = new Map<string, number>()
  for (const item of items) {
    if (!item.source) continue
    map.set(item.source, (map.get(item.source) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
}

// ============================================
// IndexedDB 持久化 (离线可读)
// ============================================
const DB_NAME = 'aihot-cache'
const DB_STORE = 'items'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE, { keyPath: 'key' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function persistToIndexedDB(items: AiHotNewsItem[]): Promise<void> {
  const db = await openDB()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, 'readwrite')
      const store = tx.objectStore(DB_STORE)
      store.put({ key: 'latest', items, ts: Date.now() })
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); resolve() }
    } catch {
      resolve()
    }
  })
}

/** 从 IndexedDB 读取上次缓存 (离线降级) */
export async function loadFromIndexedDB(): Promise<AiHotNewsItem[] | null> {
  const db = await openDB()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, 'readonly')
      const store = tx.objectStore(DB_STORE)
      const req = store.get('latest')
      req.onsuccess = () => {
        db.close()
        const result = req.result as { items?: AiHotNewsItem[]; ts?: number } | undefined
        resolve(result?.items || null)
      }
      req.onerror = () => { db.close(); resolve(null) }
    } catch {
      resolve(null)
    }
  })
}
