/**
 * 访问记录 API
 * 对接后端: app/api/v1/visit/
 * 路由前缀: /api/v1/visit
 *
 * 后端列表响应为 { code, msg, data: [...], total },
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 * 注意: 后端 track / source/record / page/record 接口使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

/** 访问日志 */
export interface VisitLog {
  id: number
  path: string
  method: string
  userId?: string | number
  ip?: string
  createTime?: string | null
}

/** 访问统计 */
export interface VisitStats {
  date?: string
  total?: number
  uniqueVisitors?: number
  pageViews?: number
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

/** 上报访问记录 (后端使用 Query 参数) */
export async function visitTrack(params: { path: string; method: string }): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/visit/track', null, {
    params: {
      path: params.path,
      method: params.method,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 访问日志列表 */
export async function visitLogList(params: { page: number; limit: number }): Promise<ApiResponse<PaginationResponse<VisitLog>>> {
  const res = await http.get('/api/v1/visit/log/list', {
    params: { page: params.page, limit: params.limit },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<VisitLog>>
}

/** 按日统计访问 */
export async function visitDailyStats(params: { startDate: string; endDate: string; targetType?: string }): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/visit/stats/daily', {
    params: {
      start_date: params.startDate,
      end_date: params.endDate,
      target_type: params.targetType || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 今日访问统计 */
export async function visitTodayStats(): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/visit/stats/today')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 访问来源统计 */
export async function visitSourceStats(params: { startDate: string; endDate: string }): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/visit/stats/source', {
    params: {
      start_date: params.startDate,
      end_date: params.endDate,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 页面访问统计 */
export async function visitPageStats(params: { startDate: string; endDate: string; limit?: number }): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/visit/stats/page', {
    params: {
      start_date: params.startDate,
      end_date: params.endDate,
      limit: params.limit ?? undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 记录访问来源 (后端使用 Query 参数) */
export async function visitRecordSource(params: { source: string; statDate: string }): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/visit/source/record', null, {
    params: {
      source: params.source,
      stat_date: params.statDate,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 记录页面访问 (后端使用 Query 参数) */
export async function visitRecordPage(params: { path: string; statDate: string; duration?: number }): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/visit/page/record', null, {
    params: {
      path: params.path,
      stat_date: params.statDate,
      duration: params.duration ?? undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const visitApi = {
  visitTrack,
  visitLogList,
  visitDailyStats,
  visitTodayStats,
  visitSourceStats,
  visitPageStats,
  visitRecordSource,
  visitRecordPage,
}

export default visitApi
