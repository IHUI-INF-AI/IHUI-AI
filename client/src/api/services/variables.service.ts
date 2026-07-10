import type { Recordable, ApiResponse } from '@/types'
import { http } from '@/utils/http'

export interface Variable {
  id?: number | string
  key?: string
  name?: string
  value?: string
  description?: string
  [key: string]: unknown
}

export async function listVariables(params?: Recordable): Promise<ApiResponse<Variable[]>> {
  const data = await http.get<Variable[]>('/coze/variables/list', params)
  return http.toApiResponse(data)
}
export async function createVariable(data: Recordable): Promise<ApiResponse<Variable>> {
  const res = await http.post<Variable>('/coze/variables/create', data)
  return http.toApiResponse(res)
}
export async function updateVariable(data: Recordable): Promise<ApiResponse> {
  const res = await http.post('/coze/variables/update', data)
  return http.toApiResponse(res)
}
export async function deleteVariable(data: Recordable): Promise<ApiResponse> {
  const res = await http.post('/coze/variables/delete', data)
  return http.toApiResponse(res)
}
