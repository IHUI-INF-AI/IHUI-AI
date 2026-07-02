/**
 * 全站搜索 API
 * 对接后端: app/api/v1/search/search.py
 * 路由前缀: /api/v1/search
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 * 注意: 后端 index/hot-keyword 等接口均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface SearchQueryParams {
  current?: number
  size?: number
  keyword?: string
  targetType?: string
  category?: string
  orderBy?: string
  [k: string]: unknown
}

export interface SearchLogListParams {
  current?: number
  size?: number
  keyword?: string
  userId?: string
  status?: string
  [k: string]: unknown
}

export interface SearchResult {
  id: number
  type: string
  title: string
  content?: string
  url?: string
  score?: number
  highlight?: string
}

export interface SearchIndex {
  idxId: number
  targetType: string
  targetId: number
  content?: string
  createTime?: string | null
}

export interface HotKeyword {
  kid: number
  keyword: string
  count: number
  createTime?: string | null
}

// 统一构造 ApiResponse<{records, total}> 格式
function toListResult(rows: unknown[], total: number, msg = 'success'): ApiResponse<{ records: unknown[]; total: number }> {
  return {
    code: 0,
    message: msg,
    data: { records: rows, total },
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<{ records: unknown[]; total: number }>
}

function toDataResult(data: unknown, msg = 'success'): ApiResponse<unknown> {
  return {
    code: 0,
    message: msg,
    data,
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<unknown>
}

/** 全文搜索 */
export async function searchQuery(params: SearchQueryParams = {}): Promise<ApiResponse<PaginationResponse<SearchResult>>> {
  const res = await http.get('/api/v1/search/query', {
    params: {
      keyword: params.keyword || '',
      page: params.current ?? 1,
      limit: params.size ?? 20,
      target_type: params.targetType || undefined,
      category: params.category || undefined,
      order_by: params.orderBy || 'weight',
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<SearchResult>>
}

/** 热搜词 */
export async function searchHot(limit = 20): Promise<ApiResponse<HotKeyword[]>> {
  const res = await http.get('/api/v1/search/hot', { params: { limit } })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<HotKeyword[]>
}

/** 搜索建议 */
export async function searchSuggest(keyword: string, limit = 10): Promise<ApiResponse<string[]>> {
  const res = await http.get('/api/v1/search/suggest', { params: { keyword, limit } })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<string[]>
}

/** 创建/更新索引 (后端使用 Query 参数) */
export async function searchIndexCreate(payload: {
  targetType: string
  targetId: number
  title: string
  content?: string
  keywords?: string
  category?: string
  tags?: string
  cover?: string
  url?: string
  userId?: string
  userName?: string
  weight?: number
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/search/index', null, {
    params: {
      target_type: payload.targetType,
      target_id: payload.targetId,
      title: payload.title,
      content: payload.content || undefined,
      keywords: payload.keywords || undefined,
      category: payload.category || undefined,
      tags: payload.tags || undefined,
      cover: payload.cover || undefined,
      url: payload.url || undefined,
      user_id: payload.userId || undefined,
      user_name: payload.userName || undefined,
      weight: payload.weight ?? 0,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 删除索引 */
export async function searchIndexDelete(idxId: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/search/index/${idxId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 按目标删除索引 (后端仅提供按目标删除接口, 无独立查询接口) */
export async function searchIndexByTarget(targetType: string, targetId: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete('/api/v1/search/index/by-target', {
    params: { target_type: targetType, target_id: targetId },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 热搜关键词列表 */
export async function searchHotKeywordList(limit = 20): Promise<ApiResponse<HotKeyword[]>> {
  const res = await http.get('/api/v1/search/hot', { params: { limit } })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<HotKeyword[]>
}

/** 新增热搜词 (后端使用 Query 参数) */
export async function searchHotKeywordCreate(payload: { keyword: string; isHot?: boolean; sortOrder?: number }): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/search/hot/keyword', null, {
    params: {
      keyword: payload.keyword,
      is_hot: payload.isHot ?? false,
      sort_order: payload.sortOrder ?? 0,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 删除热搜词 */
export async function searchHotKeywordDelete(kid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/search/hot/keyword/${kid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 搜索日志列表 */
export async function searchLogList(params: SearchLogListParams = {}): Promise<ApiResponse<PaginationResponse<unknown>>> {
  const res = await http.get('/api/v1/search/log/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      user_id: params.userId || undefined,
      keyword: params.keyword || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<unknown>>
}

export const searchApi = {
  searchQuery,
  searchHot,
  searchSuggest,
  searchIndexCreate,
  searchIndexDelete,
  searchIndexByTarget,
  searchHotKeywordList,
  searchHotKeywordCreate,
  searchHotKeywordDelete,
  searchLogList,
}

export default searchApi
