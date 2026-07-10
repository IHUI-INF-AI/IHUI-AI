import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface AgentSettlement {
  id?: number | string
  agent_name?: string
  amount?: number
  status?: string
  order_no?: string
  accountType?: string
  total?: number
  settlement?: string
  withdrawal?: string
  create_time?: string
  [key: string]: unknown
}

export interface SettlementOverview {
  total_amount: number
  pending_count?: number
  settled_count?: number
  total_settlements?: number
  unsettled_count?: number
  [key: string]: unknown
}

export async function getSettlementList(params?: Recordable): Promise<ApiResponse<PaginatedData<AgentSettlement>>> {
  const data = await http.get<PaginatedData<AgentSettlement>>('/agents/settlement/list', params)
  return http.toApiResponse(data)
}
export async function getSettlementDetail(id: number | string): Promise<ApiResponse<AgentSettlement | null>> {
  const data = await http.get<AgentSettlement | null>(`/agents/settlement/${id}`)
  return http.toApiResponse(data)
}
export async function getSettlementOverview(): Promise<ApiResponse<SettlementOverview>> {
  const data = await http.get<SettlementOverview>('/agents/settlement/summary')
  return http.toApiResponse(data)
}
export async function deleteSettlement(ids: number | string | number[]): Promise<ApiResponse> {
  const res = await http.delete(`/agents/settlement/${Array.isArray(ids) ? ids.join(',') : ids}`)
  return http.toApiResponse(res)
}
export async function batchDeleteSettlement(ids: (number | string)[]): Promise<ApiResponse> {
  const res = await http.delete('/agents/settlement', { ids: ids.join(',') })
  return http.toApiResponse(res)
}
export async function syncExistingToSettlement(params?: Recordable): Promise<ApiResponse> {
  const res = await http.post('/agents/settlement/settle', params)
  return http.toApiResponse(res)
}
