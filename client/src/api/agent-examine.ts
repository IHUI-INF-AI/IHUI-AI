import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface AgentExamine {
  id?: number | string
  agent_name?: string
  status?: number
  type?: string
  account?: string
  agent_id?: string
  agent_avatar?: string
  start_name?: string
  start_time?: string
  examine_time?: string
  examine_user?: string
  desc?: string
  category_info?: { type?: string; account?: number | string }
  [key: string]: unknown
}

export interface AgentExamineStats {
  total?: number
  pending?: number
  approved?: number
  rejected?: number
  [key: string]: unknown
}

export async function getAgentExamineList(params?: Recordable): Promise<ApiResponse<PaginatedData<AgentExamine>>> {
  const data = await http.get<PaginatedData<AgentExamine>>('/agents/examine/examine/list', params)
  return http.toApiResponse(data)
}
export async function getAgentExamineDetail(id: number | string): Promise<ApiResponse<AgentExamine | null>> {
  const data = await http.get<AgentExamine | null>(`/agents/examine/examine/${id}`)
  return http.toApiResponse(data)
}
export async function getAgentExamineStats(): Promise<ApiResponse<AgentExamineStats>> {
  const data = await http.get<AgentExamineStats>('/agents/examine/examine/stats/summary')
  return http.toApiResponse(data)
}
export async function approveAgentExamine(id: number | string, data?: Recordable): Promise<ApiResponse> {
  const res = await http.put(`/agents/examine/examine/${id}/approve`, data)
  return http.toApiResponse(res)
}
export async function rejectAgentExamine(id: number | string, reason?: string): Promise<ApiResponse> {
  const res = await http.put(`/agents/examine/examine/${id}/reject`, { reason })
  return http.toApiResponse(res)
}
export async function syncAgentAvatar(id: number | string): Promise<ApiResponse> {
  const res = await http.post(`/agents/examine/examine/${id}/sync-avatar`)
  return http.toApiResponse(res)
}
export async function batchSyncAgentAvatar(ids: (number | string)[]): Promise<ApiResponse> {
  const res = await http.post('/agents/examine/examine/batch-sync-avatar', { ids })
  return http.toApiResponse(res)
}
