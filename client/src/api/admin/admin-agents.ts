import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface AgentRecord {
  agentId?: number | string
  agentName?: string
  status?: string
  [key: string]: unknown
}

export async function getAdminAgents(params?: Recordable): Promise<ApiResponse<PaginatedData<AgentRecord>>> {
  const data = await http.get<PaginatedData<AgentRecord>>('/agents/list', params)
  return http.toApiResponse(data)
}
