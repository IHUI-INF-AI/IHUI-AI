import type { Recordable, ApiResponse } from '@/types'
import { http } from '@/utils/http'

export interface CreateSwarmRequest {
  name?: string
  task?: string
  userId?: string
  agents?: Recordable[]
  options?: Record<string, any>
  autoOptimize?: boolean
  [key: string]: unknown
}

export async function createAgenticSwarm(data: CreateSwarmRequest): Promise<ApiResponse<{ swarmId: string; [key: string]: unknown }>> {
  const res = await http.post<{ swarmId: string; [key: string]: unknown }>('/agent/zhsAgent', data as Recordable)
  return http.toApiResponse(res)
}
export async function getUserSwarms(userIdOrParams?: string | Recordable, params?: Recordable): Promise<ApiResponse<{ items: Recordable[]; [key: string]: unknown }>> {
  const query: Recordable = typeof userIdOrParams === 'string' ? { userId: userIdOrParams, ...(params || {}) } : (userIdOrParams || {})
  const data = await http.get<{ items: Recordable[]; [key: string]: unknown }>('/agent/zhsAgent/list', query)
  return http.toApiResponse(data)
}
