/**
 * 日志管理 API
 * 对接后端: app/api/v1/system/audit.py
 * 路由前缀: /api/v1/system/audit
 *
 * 后端列表返回 {code, msg, data:[...], total};
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface LogListParams {
  current?: number
  size?: number
  keyword?: string
  title?: string
  operName?: string
  businessType?: number
  userName?: string
  status?: string | number
  beginTime?: string
  endTime?: string
  [k: string]: unknown
}

export interface OperLogItem {
  oper_id: number
  title: string
  business_type: number
  method?: string
  request_method?: string
  oper_name: string
  oper_url?: string
  oper_ip?: string
  status: number
  error_msg?: string
  oper_time?: string | null
}

export interface LoginInfoItem {
  info_id: number
  user_name: string
  ipaddr?: string
  login_location?: string
  browser?: string
  os?: string
  status: string
  msg?: string
  login_time?: string | null
}

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
// 操作日志
// ===========================================================================

export async function operlogList(params: LogListParams = {}): Promise<ApiResponse<{ records: OperLogItem[]; total: number }>> {
  const res = await http.get('/api/v1/system/audit/operlog/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      title: params.title || params.keyword || undefined,
      oper_name: params.operName || undefined,
      business_type: params.businessType,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: OperLogItem[]; total: number }>
}

export async function operlogClean(days = 90): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/system/audit/operlog/clean', null, { params: { days } })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 登录日志
// ===========================================================================

export async function logininforList(params: LogListParams = {}): Promise<ApiResponse<{ records: LoginInfoItem[]; total: number }>> {
  const res = await http.get('/api/v1/system/audit/logininfor/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      user_name: params.userName || params.keyword || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: LoginInfoItem[]; total: number }>
}

export async function logininforClean(days = 90): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/system/audit/logininfor/clean', null, { params: { days } })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const logApi = {
  operlogList,
  operlogClean,
  logininforList,
  logininforClean,
}

export default logApi
