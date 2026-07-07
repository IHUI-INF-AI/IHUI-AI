/**
 * AI 动态/资讯聚合 API
 * 对标 insprira(灵感熔炉), 但完全自研, 数据源: DailyHotApi + RSSHub + arXiv/HF/HN
 *
 * 后端路由前缀: /api/v1/ai-feed
 * 通过 Vite /api 代理直达后端 (不经过 /api-kou)
 */
import request from '@/utils/request-compat'

const AI_FEED_BASE = '/api/v1/ai-feed'

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------
export interface AiFeedSource {
  id: number
  source_code: string
  source_name: string
  source_type: 'hotlist' | 'rss' | 'api'
  endpoint: string
  category: string
  icon?: string
  color?: string
  enabled: boolean
  sort_order: number
  fetch_interval_minutes: number
  last_fetch_at?: string | null
  last_fetch_status?: string | null
  last_fetch_count?: number | null
  description?: string
}

export interface AiFeedItem {
  id: number
  source_code: string
  source_name: string
  source_color?: string
  source_category?: string
  platform_item_id: string
  title: string
  summary?: string
  llm_summary?: string
  llm_category?: string
  llm_tags: string[]
  url?: string
  cover_url?: string
  author?: string
  current_rank?: number
  current_hot?: number
  trend_tag?: 'rising' | 'stable' | 'cooling' | 'new' | null
  trend_growth_pct?: number | null
  publish_time?: string | null
  first_seen_at?: string
  last_seen_at?: string
  title_en?: string
  title_ja?: string
  title_ko?: string
}

export interface AiFeedListResponse {
  items: AiFeedItem[]
  total: number
  page: number
  limit: number
}

export interface AiFeedTrendChart {
  item: AiFeedItem
  dates: string[]
  hot_values: number[]
  ranks: (number | null)[]
  trends: Record<string, {
    growth_pct: number | null
    rank_delta: number | null
    trend_tag: string
    snapshot_count: number | null
  }>
}

export interface AiFeedStats {
  sources: (AiFeedSource & { total_items: number })[]
}

export interface AiFeedTopic {
  topic_title: string
  topic_tags: string[]
  source_count: number
  sources: string[]
  source_names: string[]
  total_hot: number
  best_rank: number | null
  aggregate_trend: 'rising' | 'stable' | 'cooling' | 'new'
  items: AiFeedItem[]
  item_count: number
  representative_item_id: number
}

/**
 * AI 动态 API 统一返回结构
 * request-compat 返回 Axios 响应体, 业务层取 res.data / res.total / res.code。
 * 显式声明返回类型, 消除调用方 `Property 'data' does not exist on type '{}'` 错误。
 */
export interface AiFeedApiResult<T = unknown> {
  code?: number
  message?: string
  data?: T
  total?: number
}

// ---------------------------------------------------------------------------
// API 函数
// ---------------------------------------------------------------------------

/** 获取数据源列表(动态 Tab 渲染) */
export function getAiFeedSources(enabledOnly = true): Promise<AiFeedApiResult<AiFeedSource[]>> {
  return request({
    url: `${AI_FEED_BASE}/sources`,
    method: 'GET',
    data: { enabled_only: enabledOnly },
    base: 0,
    silent500: true,
  } as never)
}

/** 获取跨源热点聚合(同一话题在多平台的传播分析) */
export function getAiFeedTopics(params?: {
  hours?: number
  min_sources?: number
  limit?: number
}): Promise<AiFeedApiResult<AiFeedTopic[]>> {
  return request({
    url: `${AI_FEED_BASE}/topics`,
    method: 'GET',
    data: {
      hours: params?.hours ?? 48,
      min_sources: params?.min_sources ?? 2,
      limit: params?.limit ?? 20,
    },
    base: 0,
    silent500: true,
  } as never)
}

/** 获取趋势爆发通知(轮询用) */
export function getAiFeedNotifications(params?: {
  hours?: number
  min_growth?: number
  limit?: number
}): Promise<AiFeedApiResult<AiFeedItem[] | { items: AiFeedItem[] }>> {
  return request({
    url: `${AI_FEED_BASE}/notifications`,
    method: 'GET',
    data: {
      hours: params?.hours ?? 24,
      min_growth: params?.min_growth ?? 15,
      limit: params?.limit ?? 10,
    },
    base: 0,
    silent500: true,
  } as never)
}

/** 获取资讯条目列表(支持多维度筛选) */
export function getAiFeedItems(params: {
  source?: string
  category?: string
  trend?: string
  keyword?: string
  page?: number
  limit?: number
}): Promise<AiFeedApiResult<AiFeedItem[] | AiFeedListResponse>> {
  return request({
    url: `${AI_FEED_BASE}/items`,
    method: 'GET',
    data: {
      source: params.source,
      category: params.category,
      trend: params.trend,
      keyword: params.keyword,
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    },
    base: 0,
    silent500: true,
  } as never)
}

/** 获取条目详情 */
export function getAiFeedItem(itemId: number): Promise<AiFeedApiResult<AiFeedItem>> {
  return request({
    url: `${AI_FEED_BASE}/items/${itemId}`,
    method: 'GET',
    base: 0,
    silent500: true,
  } as never)
}

/** 获取趋势图表数据 */
export function getAiFeedTrend(itemId: number, window = 14): Promise<AiFeedApiResult<AiFeedTrendChart>> {
  return request({
    url: `${AI_FEED_BASE}/trend/${itemId}`,
    method: 'GET',
    data: { window },
    base: 0,
    silent500: true,
  } as never)
}

/** 获取数据源采集统计(管理用) */
export function getAiFeedStats(): Promise<AiFeedApiResult<AiFeedStats>> {
  return request({
    url: `${AI_FEED_BASE}/stats`,
    method: 'GET',
    base: 0,
    silent500: true,
  } as never)
}

/** 手动触发采集(管理员) */
export function triggerAiFeedFetch(): Promise<AiFeedApiResult<unknown>> {
  return request({
    url: `${AI_FEED_BASE}/fetch`,
    method: 'POST',
    base: 0,
  } as never)
}

/** 手动触发趋势计算(管理员) */
export function triggerAiFeedTrend(): Promise<AiFeedApiResult<unknown>> {
  return request({
    url: `${AI_FEED_BASE}/trend`,
    method: 'POST',
    base: 0,
  } as never)
}

/** 手动触发 LLM 分类摘要(管理员) */
export function triggerAiFeedLlm(limit = 100): Promise<AiFeedApiResult<unknown>> {
  return request({
    url: `${AI_FEED_BASE}/llm`,
    method: 'GET',
    data: { limit },
    base: 0,
  } as never)
}

/** 更新数据源配置(管理员) */
export function updateAiFeedSource(sourceId: number, body: Partial<AiFeedSource>): Promise<AiFeedApiResult<unknown>> {
  return request({
    url: `${AI_FEED_BASE}/sources/${sourceId}`,
    method: 'PUT',
    data: body,
    base: 0,
  } as never)
}
