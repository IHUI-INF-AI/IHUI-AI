import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface RoleRecord {
  roleId?: number | string
  roleName?: string
  roleKey?: string
  status?: string
  [key: string]: unknown
}

export async function roleList(params?: Recordable): Promise<ApiResponse<PaginatedData<RoleRecord>>> {
  const data = await http.get<{ list: RoleRecord[] }>('/roles', params)
  const list = data.list ?? []
  return http.toApiResponse({
    list,
    pagination: { total: list.length },
    total: list.length,
  })
}
export async function roleCreate(data: Recordable): Promise<ApiResponse> {
  const res = await http.post<{ role: RoleRecord }>('/roles', data)
  return http.toApiResponse(res.role)
}
export async function roleUpdate(data: Recordable): Promise<ApiResponse> {
  const id = data.roleId ?? data.id
  const { roleId, id: _id, ...body } = data
  const res = await http.patch<{ role: RoleRecord }>(`/roles/${id}`, body)
  return http.toApiResponse(res.role)
}
export async function roleDelete(ids: number[] | string): Promise<ApiResponse> {
  const id = Array.isArray(ids) ? ids[0] : ids
  const res = await http.delete<{ id: number | string }>(`/roles/${id}`)
  return http.toApiResponse(res.id)
}
