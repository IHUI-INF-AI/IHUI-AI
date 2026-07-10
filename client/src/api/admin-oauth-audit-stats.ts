import type { Recordable, ApiResponse } from '@/types'
import { http } from '@/utils/http'

export interface AuditLogStats {
  days?: number
  start?: string
  end?: string
  total?: number
  success_count?: number
  failure_count?: number
  by_day: Array<{ date: string; count: number }>
  by_event: Array<{
    event: string
    total: number
    success: number
    failure: number
    client_id?: string
    count?: number
    [key: string]: unknown
  }>
  by_client: Array<{
    client_id: string
    count: number
    [key: string]: unknown
  }>
  [key: string]: unknown
}

export async function getOAuthAuditLogStats(params?: Recordable): Promise<ApiResponse<AuditLogStats>> {
  const data = await http.get<AuditLogStats>('/agents/oauth-apps/audit-logs/stats', params)
  return http.toApiResponse(data)
}
