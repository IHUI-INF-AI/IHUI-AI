import { fetchApi } from '@/lib/api'
import type {
  AiWorldData,
  AiCategory,
  PaginatedItems,
  PaginatedRankings,
  LeaderboardInfo,
  LeaderboardId,
  ItemKind,
} from './types'

async function api<T>(url: string): Promise<T> {
  const res = await fetchApi<T>(url)
  if (!res.success) throw new Error(res.error)
  return res.data
}

export async function fetchAiWorld(): Promise<AiWorldData> {
  return api<AiWorldData>('/api/ai-world')
}

export async function fetchAiWorldCategories(): Promise<AiCategory[]> {
  return api<AiCategory[]>('/api/ai-world/categories')
}

export interface FetchItemsParams {
  kind: ItemKind
  category?: string
  limit?: number
  offset?: number
  search?: string
  order?: 'latest' | 'hot' | 'published' | 'trending'
}

export async function fetchAiWorldItems(params: FetchItemsParams): Promise<PaginatedItems> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.offset) qs.set('offset', String(params.offset))
  if (params.search) qs.set('search', params.search)
  if (params.order) qs.set('order', params.order)
  const suffix = qs.toString()
  return api<PaginatedItems>(`/api/ai-world/${params.kind}s${suffix ? `?${suffix}` : ''}`)
}

export interface FetchRankingsParams {
  leaderboard?: LeaderboardId
  category?: string
  limit?: number
  offset?: number
}

export async function fetchAiWorldRankings(params: FetchRankingsParams): Promise<PaginatedRankings> {
  const qs = new URLSearchParams()
  if (params.leaderboard) qs.set('leaderboard', params.leaderboard)
  if (params.category) qs.set('category', params.category)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.offset) qs.set('offset', String(params.offset))
  const suffix = qs.toString()
  return api<PaginatedRankings>(`/api/ai-world/rankings${suffix ? `?${suffix}` : ''}`)
}

export async function fetchLeaderboards(): Promise<LeaderboardInfo[]> {
  const res = await api<{ leaderboards: LeaderboardInfo[]; total: number }>('/api/ai-world/rankings/leaderboards')
  return res.leaderboards
}

export interface FetchTrendingParams {
  kind?: ItemKind
  limit?: number
  offset?: number
}

export async function fetchTrendingItems(params: FetchTrendingParams): Promise<PaginatedItems> {
  const qs = new URLSearchParams()
  if (params.kind) qs.set('kind', params.kind)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.offset) qs.set('offset', String(params.offset))
  const suffix = qs.toString()
  return api<PaginatedItems>(`/api/ai-world/trending${suffix ? `?${suffix}` : ''}`)
}
