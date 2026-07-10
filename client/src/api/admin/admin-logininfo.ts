import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface LoginInfoRecord {
  loginInfoId?: number | string
  userName?: string
  ipaddr?: string
  loginLocation?: string
  browser?: string
  os?: string
  status?: string
  msg?: string
  [key: string]: unknown
}

export async function loginInfoList(params?: Recordable): Promise<ApiResponse<PaginatedData<LoginInfoRecord>>> {
  const data = await http.get<PaginatedData<LoginInfoRecord>>('/admin/logininfor/list', params)
  return http.toApiResponse(data)
}
