/**
 * 服务目录 API (服务注册/心跳/调用日志)
 * 对接后端: app/api/v1/service_catalog/service_catalog.py
 * 路由前缀: /api/v1/service-catalog
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 * 注意: 后端 register/update/heartbeat 等接口均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface ServiceCatalogListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  group?: string
  type?: string
  [k: string]: unknown
}

/** 服务目录 */
export interface ServiceCatalog {
  sid: number
  code: string
  name: string
  type?: string
  host?: string
  port?: number
  path?: string
  version?: string
  description?: string
  group?: string
  tags?: string
  healthUrl?: string
  weight?: number
  status: string
  config?: string
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
// 服务目录
// ===========================================================================

/** 服务目录列表 (按 group/type/status/keyword 过滤,无分页) */
export async function serviceCatalogList(params: ServiceCatalogListParams = {}): Promise<ApiResponse<ServiceCatalog[]>> {
  const res = await http.get('/api/v1/service-catalog/list', {
    params: {
      group: params.group || undefined,
      type: params.type || undefined,
      status: params.status || undefined,
      keyword: params.keyword || undefined,
    },
  })
  const body = (res as any).data || {}
  // 服务列表无分页
  return toDataResult(body.data || [], body.msg) as unknown as ApiResponse<ServiceCatalog[]>
}

/** 服务详情 (sid 走路径参数) */
export async function serviceCatalogDetail(sid: number): Promise<ApiResponse<ServiceCatalog | null>> {
  const res = await http.get(`/api/v1/service-catalog/${sid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<ServiceCatalog | null>
}

/** 注册服务 */
export async function serviceCatalogRegister(params: {
  code: string
  name: string
  type?: string
  host?: string
  port?: number
  path?: string
  version?: string
  description?: string
  group?: string
  tags?: string
  healthUrl?: string
  weight?: number
  config?: string
}): Promise<ApiResponse<ServiceCatalog>> {
  const res = await http.post('/api/v1/service-catalog', null, {
    params: {
      code: params.code,
      name: params.name,
      type: params.type || undefined,
      host: params.host || undefined,
      port: params.port,
      path: params.path || undefined,
      version: params.version || undefined,
      description: params.description || undefined,
      group: params.group || undefined,
      tags: params.tags || undefined,
      healthUrl: params.healthUrl || undefined,
      weight: params.weight,
      config: params.config || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<ServiceCatalog>
}
/** 修改服务 (sid 走路径参数,其余走 Query) */
export async function serviceCatalogUpdate(sid: number, params: {
  code?: string
  name?: string
  type?: string
  host?: string
  port?: number
  path?: string
  version?: string
  description?: string
  group?: string
  tags?: string
  healthUrl?: string
  weight?: number
  config?: string
}): Promise<ApiResponse<ServiceCatalog>> {
  const res = await http.put(`/api/v1/service-catalog/${sid}`, null, {
    params: {
      code: params.code || undefined,
      name: params.name || undefined,
      type: params.type || undefined,
      host: params.host || undefined,
      port: params.port,
      path: params.path || undefined,
      version: params.version || undefined,
      description: params.description || undefined,
      group: params.group || undefined,
      tags: params.tags || undefined,
      healthUrl: params.healthUrl || undefined,
      weight: params.weight,
      config: params.config || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<ServiceCatalog>
}

/** 删除服务 (sid 走路径参数) */
export async function serviceCatalogDelete(sid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/service-catalog/${sid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 服务心跳 (sid 走路径参数,其余走 Query) */
export async function serviceCatalogHeartbeat(sid: number, params: { isHealthy?: boolean; errorMsg?: string }): Promise<ApiResponse<unknown>> {
  const res = await http.post(`/api/v1/service-catalog/${sid}/heartbeat`, null, {
    params: {
      isHealthy: params.isHealthy,
      errorMsg: params.errorMsg || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 调用日志列表 */
export async function serviceCatalogCallLogList(params: { page?: number; limit?: number; serviceCode?: string; status?: string }): Promise<ApiResponse<PaginationResponse<unknown>>> {
  const res = await http.get('/api/v1/service-catalog/log/list', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      serviceCode: params.serviceCode || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<unknown>>
}

export const serviceCatalogApi = {
  serviceCatalogList,
  serviceCatalogDetail,
  serviceCatalogRegister,
  serviceCatalogUpdate,
  serviceCatalogDelete,
  serviceCatalogHeartbeat,
  serviceCatalogCallLogList,
}

export default serviceCatalogApi