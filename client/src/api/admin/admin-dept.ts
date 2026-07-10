import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface DeptRecord {
  deptId?: number | string
  deptName?: string
  parentId?: number | string
  orderNum?: number
  leader?: string
  status?: string
  [key: string]: unknown
}

export async function deptList(params?: Recordable): Promise<ApiResponse<PaginatedData<DeptRecord>>> {
  const data = await http.get<{ list: DeptRecord[]; total: number; page: number; pageSize: number }>(
    '/admin/members/departments',
    params,
  )
  return http.toApiResponse({
    list: data.list,
    pagination: { total: data.total },
    total: data.total,
  })
}
export async function deptCreate(data: Recordable): Promise<ApiResponse> {
  const res = await http.post<{ id: number | string }>('/admin/members/departments', data)
  return http.toApiResponse(res.id)
}
export async function deptUpdate(data: Recordable): Promise<ApiResponse> {
  const id = data.deptId ?? data.id
  const { deptId, id: _id, ...body } = data
  const res = await http.put<{ id: number | string }>(`/admin/members/departments/${id}`, body)
  return http.toApiResponse(res.id)
}
export async function deptDelete(ids: number[] | string): Promise<ApiResponse> {
  const id = Array.isArray(ids) ? ids[0] : ids
  const res = await http.delete<{ ok: boolean }>(`/admin/members/departments/${id}`)
  return http.toApiResponse(res.ok)
}
