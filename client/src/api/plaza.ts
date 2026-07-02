/**
 * 广场智能体 API
 * 对接后端: app/api/v1/plaza/plaza.py
 * 路由前缀: /api/v1/plaza
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface PlazaListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  category?: string
  [k: string]: unknown
}

/** 广场智能体 */
export interface PlazaAgent {
  id: number
  name: string
  description?: string
  category?: string
  status: string
  usageCount?: number
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

// ===========================================================================
// 广场智能体
// ===========================================================================

/** 广场智能体列表 */
export async function plazaList(params: PlazaListParams = {}): Promise<ApiResponse<PaginationResponse<PlazaAgent>>> {
  const res = await http.get('/api/v1/plaza/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      category: params.category || undefined,
      status: params.status || undefined,
      keyword: params.keyword || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<PlazaAgent>>
}

export const plazaApi = {
  plazaList,
}

export default plazaApi