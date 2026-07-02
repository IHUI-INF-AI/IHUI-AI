/**
 * 教育平台 API (平台/同步日志)
 * 对接后端: app/api/v1/education_platform/education_platform.py
 * 路由前缀: /api/v1/education-platform
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 * 注意: 后端 create/update/sync 等接口均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface EducationPlatformListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  [k: string]: unknown
}

/** 教育平台 */
export interface EducationPlatform {
  pid: number
  name: string
  code: string
  type?: string
  apiUrl?: string
  apiKey?: string
  apiSecret?: string
  config?: string
  syncUrl?: string
  description?: string
  status: string
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

// ===========================================================================
// 教育平台
// ===========================================================================

/** 教育平台列表 (按 status 过滤,无分页) */
export async function educationPlatformList(params: EducationPlatformListParams = {}): Promise<ApiResponse<EducationPlatform[]>> {
  const res = await http.get('/api/v1/education-platform/list', {
    params: {
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  // 平台列表无分页
  return toDataResult(body.data || [], body.msg) as unknown as ApiResponse<EducationPlatform[]>
}

/** 创建教育平台 */
export async function educationPlatformCreate(params: {
  name: string
  code: string
  type?: string
  apiUrl?: string
  apiKey?: string
  apiSecret?: string
  config?: string
  syncUrl?: string
  description?: string
}): Promise<ApiResponse<EducationPlatform>> {
  const res = await http.post('/api/v1/education-platform', null, {
    params: {
      name: params.name,
      code: params.code,
      type: params.type || undefined,
      apiUrl: params.apiUrl || undefined,
      apiKey: params.apiKey || undefined,
      apiSecret: params.apiSecret || undefined,
      config: params.config || undefined,
      syncUrl: params.syncUrl || undefined,
      description: params.description || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<EducationPlatform>
}

/** 修改教育平台 (pid 走路径参数,其余走 Query) */
export async function educationPlatformUpdate(pid: number, params: {
  name?: string
  code?: string
  type?: string
  apiUrl?: string
  apiKey?: string
  apiSecret?: string
  config?: string
  syncUrl?: string
  description?: string
}): Promise<ApiResponse<EducationPlatform>> {
  const res = await http.put(`/api/v1/education-platform/${pid}`, null, {
    params: {
      name: params.name || undefined,
      code: params.code || undefined,
      type: params.type || undefined,
      apiUrl: params.apiUrl || undefined,
      apiKey: params.apiKey || undefined,
      apiSecret: params.apiSecret || undefined,
      config: params.config || undefined,
      syncUrl: params.syncUrl || undefined,
      description: params.description || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<EducationPlatform>
}

/** 删除教育平台 (pid 走路径参数) */
export async function educationPlatformDelete(pid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/education-platform/${pid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 触发平台同步 (pid 走路径参数,其余走 Query) */
export async function educationPlatformSync(pid: number, params: { type?: string; syncType?: string }): Promise<ApiResponse<unknown>> {
  const res = await http.post(`/api/v1/education-platform/${pid}/sync`, null, {
    params: {
      type: params.type || undefined,
      syncType: params.syncType || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 同步日志列表 */
export async function educationPlatformSyncLog(params: { page?: number; limit?: number; platformCode?: string }): Promise<ApiResponse<PaginationResponse<unknown>>> {
  const res = await http.get('/api/v1/education-platform/sync/log', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      platformCode: params.platformCode || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<unknown>>
}

export const educationPlatformApi = {
  educationPlatformList,
  educationPlatformCreate,
  educationPlatformUpdate,
  educationPlatformDelete,
  educationPlatformSync,
  educationPlatformSyncLog,
}

export default educationPlatformApi