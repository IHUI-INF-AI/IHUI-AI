/**
 * 参数配置管理 API
 * 对接后端: app/api/v1/admin_panel.py (config_router, prefix=/config)
 * 路由前缀: /api/v1/config
 *
 * 后端列表返回 {code, msg, data:[...], total};
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface ConfigListParams {
  current?: number
  size?: number
  keyword?: string
  configName?: string
  configKey?: string
  configType?: string
  [k: string]: unknown
}

export interface AdminConfig {
  /** 参数 ID */
  configId: number
  /** 参数名称 */
  configName: string
  /** 参数键名 */
  configKey: string
  /** 参数键值 */
  configValue: string
  /** 是否为系统内置 (Y=是 N=否) */
  configType: string
  /** 备注 */
  remark?: string
  /** 创建时间 */
  createTime?: string | null
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
// 参数配置 CRUD
// ===========================================================================

/** 参数列表 (分页) */
export async function configList(params: ConfigListParams = {}): Promise<ApiResponse<{ records: AdminConfig[]; total: number }>> {
  const res = await http.get('/api/v1/config/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      configName: params.configName || params.keyword || undefined,
      configKey: params.configKey || undefined,
      configType: params.configType || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: AdminConfig[]; total: number }>
}

/** 参数详情 */
export async function configDetail(configId: number): Promise<ApiResponse<AdminConfig | null>> {
  const res = await http.get(`/api/v1/config/${configId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminConfig | null>
}

/** 新增参数 */
export async function configCreate(payload: Partial<AdminConfig>): Promise<ApiResponse<AdminConfig>> {
  const res = await http.post('/api/v1/config', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminConfig>
}

/** 修改参数 */
export async function configUpdate(payload: Partial<AdminConfig> & { configId: number }): Promise<ApiResponse<AdminConfig>> {
  const res = await http.put('/api/v1/config', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminConfig>
}

/** 删除参数 (批量, 逗号分隔) */
export async function configDelete(configIds: (string | number)[]): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/config/${configIds.join(',')}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 刷新参数缓存 */
export async function configRefreshCache(): Promise<ApiResponse<unknown>> {
  const res = await http.delete('/api/v1/config/refreshCache')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 按 key 查询参数值 */
export async function configGetConfigKey(configKey: string): Promise<ApiResponse<AdminConfig | null>> {
  const res = await http.get(`/api/v1/config/configKey/${configKey}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminConfig | null>
}

export const adminConfigApi = {
  configList,
  configDetail,
  configCreate,
  configUpdate,
  configDelete,
  configRefreshCache,
  configGetConfigKey,
}

export default adminConfigApi
