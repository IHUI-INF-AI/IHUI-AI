import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface AgentCategory {
  id?: number | string
  agent_name?: string
  agent_id?: string
  agent_main_category?: string
  agent_category?: string
  type?: string
  type_child?: string
  account?: number | string
  group?: string
  limit_free?: boolean | number
  discount_month?: number
  prologue?: string
  create_name?: string
  create_time?: string
  [key: string]: unknown
}

export async function getAgentCategoryList(params?: Recordable): Promise<ApiResponse<PaginatedData<AgentCategory>>> {
  const data = await http.get<PaginatedData<AgentCategory>>('/agents/categories/list', params)
  return http.toApiResponse(data)
}
export async function createAgentCategory(data: Recordable): Promise<ApiResponse<AgentCategory>> {
  const res = await http.post<AgentCategory>('/agents/categories/create', data)
  return http.toApiResponse(res)
}
export async function updateAgentCategory(data: Recordable): Promise<ApiResponse> {
  const id = data.id
  const res = await http.put(`/agents/categories/${id}`, data)
  return http.toApiResponse(res)
}
export async function deleteAgentCategory(id: number | string): Promise<ApiResponse> {
  const res = await http.delete(`/agents/categories/${id}`)
  return http.toApiResponse(res)
}
