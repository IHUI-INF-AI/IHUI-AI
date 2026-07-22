/**
 * 旧架构 edu-web 公开 API 端点(2026-07-22 立)
 *
 * 来源: git commit 3ee96cf09 旧架构 client/src/api/{category,article,news,
 * letter,point,search,agreement,carousel}.ts 中存在但 api-client 未导出的
 * 公开端点。函数名按新架构命名(见 LEGACY_EDU_API_RENAMES 映射表),
 * apps/web/src/lib/legacy-edu-api.ts 进一步提供旧函数名桥接层。
 *
 * 覆盖端点:
 * - /api/carousels                       (carousel.ts → getActiveCarousels)
 * - /api/agreements/current              (admin-agreements.ts → getCurrentAgreement)
 * - /api/announcements[/...]              (content.ts → getAnnouncements/Detail/Read)
 * - /api/points[/transactions]            (gamification.ts → getMyPoints/getPointTransactions)
 * - /api/search[/hot-words]              (search.ts → searchContent/getHotWords)
 */
import type { ApiResult, Carousel, Agreement, HotWord, SearchContentItem, PointRecord } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

// ===================== 类型定义 =====================

/** 公告(对齐后端 announcements 表) */
export interface Announcement {
  id: string
  title: string
  content: string
  category?: string
  isPinned?: boolean
  isPublished?: boolean
  publishTime?: string
  expireTime?: string
  isRead?: boolean
  readTime?: string
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

/** 积分账户信息(对齐后端 /api/points 响应) */
export interface PointAccountInfo {
  userId: string
  totalPoints: number
  availablePoints: number
  frozenPoints: number
  level?: number
  levelName?: string
  nextLevelPoints?: number
  [key: string]: unknown
}

/** 搜索类型(对齐后端 searchTypes) */
export interface SearchType {
  type: string
  label: string
  icon?: string
  count?: number
  [key: string]: unknown
}

/** 搜索结果(对齐后端 /api/search 响应) */
export interface SearchResult {
  total: number
  items: SearchContentItem[]
  facets?: Record<string, Array<{ value: string; count: number }>>
  took?: number
  [key: string]: unknown
}

// ===================== carousels（轮播图） =====================

/** 获取活跃轮播图(公开端点,可选 position 过滤) */
export async function getActiveCarousels(position?: string): Promise<ApiResult<Carousel[]>> {
  return fetchApi<Carousel[]>(`/api/carousels${buildQs(position ? { position } : {})}`)
}

// ===================== agreements（协议） =====================

export type AgreementType = Agreement['type']

/** 获取当前生效协议(公开端点) */
export async function getCurrentAgreement(
  type: AgreementType,
): Promise<ApiResult<Agreement>> {
  return fetchApi<Agreement>(`/api/agreements/current${buildQs({ type })}`)
}

// ===================== announcements（公告） =====================

/** 获取公告列表(公开端点,登录用户自动带 isRead 标记) */
export async function getAnnouncements(
  query: { page?: number; pageSize?: number; isPinned?: boolean } = {},
): Promise<ApiResult<PageData<Announcement>>> {
  return fetchApi<PageData<Announcement>>(`/api/announcements${buildQs(query)}`)
}

/** 获取公告详情(公开端点,仅已发布) */
export async function getAnnouncementById(id: string): Promise<ApiResult<Announcement>> {
  return fetchApi<Announcement>(`/api/announcements/${encodeURIComponent(id)}`)
}

/** 标记公告已读(需登录) */
export async function markAnnouncementRead(
  id: string,
): Promise<ApiResult<{ ok: boolean }>> {
  return fetchApi<{ ok: boolean }>(`/api/announcements/${encodeURIComponent(id)}/read`, {
    method: 'POST',
  })
}

/** 获取未读公告数(需登录) */
export async function getUnreadAnnouncementCount(): Promise<ApiResult<number>> {
  return fetchApi<number>('/api/announcements/unread/count')
}

// ===================== points（积分） =====================

/** 获取当前用户积分信息(需登录) */
export async function getMyPoints(): Promise<ApiResult<PointAccountInfo>> {
  return fetchApi<PointAccountInfo>('/api/points')
}

/** 获取积分流水(需登录) */
export async function getPointTransactions(
  query: { page?: number; pageSize?: number; type?: 'earn' | 'spend'; source?: string } = {},
): Promise<ApiResult<PageData<PointRecord>>> {
  return fetchApi<PageData<PointRecord>>(`/api/points/transactions${buildQs(query)}`)
}

// ===================== search（搜索） =====================

/** 全局搜索(需登录) */
export async function searchContent(input: {
  q: string
  type?: 'user' | 'project' | 'file' | 'all'
  limit?: number
  highlight?: boolean
  facets?: boolean
}): Promise<ApiResult<SearchResult>> {
  return fetchApi<SearchResult>(`/api/search${buildQs(input)}`)
}

/** 获取热词列表(需登录) */
export async function getSearchHotWords(
  query: { limit?: number } = {},
): Promise<ApiResult<HotWord[]>> {
  return fetchApi<HotWord[]>(`/api/search/hot-words${buildQs(query)}`)
}

/** 获取搜索历史(需登录) */
export async function getSearchHistory(
  query: { limit?: number } = {},
): Promise<ApiResult<Array<{ keyword: string; searchTime: string }>>> {
  return fetchApi<Array<{ keyword: string; searchTime: string }>>(
    `/api/search/history${buildQs(query)}`,
  )
}

/** 记录搜索历史(需登录) */
export async function addSearchHistory(keyword: string): Promise<ApiResult<{ ok: boolean }>> {
  return fetchApi<{ ok: boolean }>('/api/search/history', {
    method: 'POST',
    body: JSON.stringify({ keyword }),
  })
}

/** 清空搜索历史(需登录) */
export async function clearSearchHistory(): Promise<ApiResult<{ ok: boolean }>> {
  return fetchApi<{ ok: boolean }>('/api/search/history', { method: 'DELETE' })
}
