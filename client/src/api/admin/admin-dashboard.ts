import type { ApiResponse } from '@/types'
import { http } from '@/utils/http'

export interface DashboardOverview {
  totalUsers?: number
  totalAgents?: number
  totalOrders?: number
  totalRevenue?: number
  [key: string]: unknown
}

export async function getDashboardOverview(): Promise<ApiResponse<Partial<DashboardOverview>>> {
  const data = await http.get<Partial<DashboardOverview>>('/admin/stats')
  return http.toApiResponse(data)
}
