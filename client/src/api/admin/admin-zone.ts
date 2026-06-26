/**
 * 专区管理 API
 * 历史项目专区管理位于 general/ai_gc 模块, 后端已有 AIGC 接口
 * (路由前缀 /api/v1/content/aigc), 但无独立专区接口。
 *
 * 本文件使用占位端点 /api/v1/system/zone/*, 待后端补充真实接口后替换。
 *
 * 后端列表返回 {code, msg, data:[...], total};
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface ZoneListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  [k: string]: unknown
}

export interface ZoneItem {
  id: number
  name: string
  description?: string
  status: string
  sort: number
  create_time?: string | null
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

export async function zoneList(params: ZoneListParams = {}): Promise<ApiResponse<{ records: ZoneItem[]; total: number }>> {
  const res = await http.get('/api/v1/system/zone/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      name: params.keyword || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: ZoneItem[]; total: number }>
}

export async function zoneDetail(id: number): Promise<ApiResponse<ZoneItem | null>> {
  const res = await http.get(`/api/v1/system/zone/${id}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<ZoneItem | null>
}

export async function zoneCreate(payload: Partial<ZoneItem>): Promise<ApiResponse<ZoneItem>> {
  const res = await http.post('/api/v1/system/zone', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<ZoneItem>
}

export async function zoneUpdate(payload: Partial<ZoneItem> & { id: number }): Promise<ApiResponse<ZoneItem>> {
  const res = await http.put('/api/v1/system/zone', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<ZoneItem>
}

export async function zoneDelete(ids: (string | number)[]): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/system/zone/${ids.join(',')}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const zoneApi = {
  zoneList,
  zoneDetail,
  zoneCreate,
  zoneUpdate,
  zoneDelete,
}

export default zoneApi
