/**
 * AI 机器人站点 API (站点列表 / 分类列表)
 * 对接后端: ai-bot-sites 模块
 * 路由前缀: /api/v1/ai-bot-sites
 *
 * 后端列表响应为 { code, msg, data: { list, total, page, size } },
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface AiBotSiteListParams {
  section?: string
  keyword?: string
  page?: number
  pageSize?: number
  [k: string]: unknown
}

export interface AiBotSite {
  id: number
  name: string
  url: string
  section?: string
  description?: string
  createTime?: string | null
}

export interface AiBotSiteCategory {
  id: number
  name: string
  count: number
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

// ===========================================================================
// AI 机器人站点查询
// ===========================================================================

/** 站点列表 */
export async function aiBotSitesList(params: AiBotSiteListParams = {}): Promise<ApiResponse<PaginationResponse<AiBotSite>>> {
  const res = await http.get('/api/v1/ai-bot-sites/list', {
    params: {
      section: params.section || undefined,
      keyword: params.keyword || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    },
  })
  const body = (res as any).data || {}
  const payload = body.data || {}
  return toListResult(payload.list || [], payload.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<AiBotSite>>
}

/** 分类列表 */
export async function aiBotSitesListCategories(): Promise<ApiResponse<AiBotSiteCategory[]>> {
  const res = await http.get('/api/v1/ai-bot-sites/categories')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AiBotSiteCategory[]>
}

export const aiBotSitesApi = {
  aiBotSitesList,
  aiBotSitesListCategories,
}

export default aiBotSitesApi