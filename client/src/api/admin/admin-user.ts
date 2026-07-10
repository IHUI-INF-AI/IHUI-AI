import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface UserRecord {
  userId?: number | string
  userName?: string
  nickName?: string
  deptId?: number | string
  status?: string
  [key: string]: unknown
}

export async function userList(params?: Recordable): Promise<ApiResponse<PaginatedData<UserRecord>>> {
  const data = await http.get<{ list: UserRecord[]; total: number; page: number; pageSize: number }>(
    '/admin/users',
    params,
  )
  return http.toApiResponse({
    list: data.list,
    pagination: { total: data.total },
    total: data.total,
  })
}
export function userCreate(data: Recordable): Promise<ApiResponse> {
  return Promise.resolve({ code: 200, success: true, message: '', data: null })
}
export async function userUpdate(data: Recordable): Promise<ApiResponse> {
  const id = data.userId ?? data.id
  const { userId, id: _id, ...body } = data
  const res = await http.patch<{ user: UserRecord }>(`/admin/users/${id}`, body)
  return http.toApiResponse(res.user)
}
export function userDelete(ids: number[] | string): Promise<ApiResponse> {
  return Promise.resolve({ code: 200, success: true, message: '', data: null })
}
