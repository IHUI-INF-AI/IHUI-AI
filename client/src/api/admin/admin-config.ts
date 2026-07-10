import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface ConfigRecord {
  configId?: number | string
  configName?: string
  configKey?: string
  configValue?: string
  configType?: string
  remark?: string
  [key: string]: unknown
}

export async function configList(params?: Recordable): Promise<ApiResponse<PaginatedData<ConfigRecord>>> {
  const data = await http.get<{ list: ConfigRecord[]; total: number; page: number; pageSize: number }>(
    '/admin/configs',
    params,
  )
  return http.toApiResponse({
    list: data.list,
    pagination: { total: data.total },
    total: data.total,
  })
}
export async function configCreate(data: Recordable): Promise<ApiResponse> {
  const res = await http.post<{ config: ConfigRecord }>('/admin/configs', data)
  return http.toApiResponse(res.config)
}
export async function configUpdate(data: Recordable): Promise<ApiResponse> {
  const id = data.configId ?? data.id
  const { configId, id: _id, ...body } = data
  const res = await http.patch<{ config: ConfigRecord }>(`/admin/configs/${id}`, body)
  return http.toApiResponse(res.config)
}
export async function configDelete(ids: number[] | string): Promise<ApiResponse> {
  const id = Array.isArray(ids) ? ids[0] : ids
  const res = await http.delete<{ id: number | string }>(`/admin/configs/${id}`)
  return http.toApiResponse(res.id)
}
