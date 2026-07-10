import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface MenuRecord {
  menuId?: number | string
  menuName?: string
  parentId?: number | string
  orderNum?: number
  path?: string
  component?: string
  menuType?: string
  visible?: string
  status?: string
  [key: string]: unknown
}

export async function menuList(params?: Recordable): Promise<ApiResponse<PaginatedData<MenuRecord>>> {
  const data = await http.get<PaginatedData<MenuRecord>>('/admin/menu/list', params)
  return http.toApiResponse(data)
}
export async function menuCreate(data: Recordable): Promise<ApiResponse> {
  const res = await http.post('/admin/menu', data)
  return http.toApiResponse(res)
}
export async function menuUpdate(data: Recordable): Promise<ApiResponse> {
  const res = await http.put('/admin/menu', data)
  return http.toApiResponse(res)
}
export async function menuDelete(ids: number[] | string): Promise<ApiResponse> {
  const res = await http.delete('/admin/menu', { ids })
  return http.toApiResponse(res)
}
