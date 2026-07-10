import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface DemandItem {
  id?: number | string
  title?: string
  content?: string
  status?: string
  remark?: string
  agent_name?: string
  agent_id?: string
  type?: string
  priority?: number
  budget?: number
  deadline?: string
  create_time?: string
  developer_name?: string
  developer_id?: string
  accept_time?: string
  description?: string
  deliverable?: string
  [key: string]: unknown
}

export const demandApi = {
  async list(params?: Recordable): Promise<ApiResponse<PaginatedData<DemandItem>>> {
    const data = await http.get<PaginatedData<DemandItem>>('/plaza/list', params)
    return http.toApiResponse(data)
  },
  async approve(id: number | string): Promise<ApiResponse> {
    const res = await http.put(`/plaza/${id}/approve`)
    return http.toApiResponse(res)
  },
  async reject(id: number | string, reason?: string): Promise<ApiResponse> {
    const res = await http.put(`/plaza/${id}/reject`, { reason })
    return http.toApiResponse(res)
  },
  async detail(id: number | string): Promise<ApiResponse<DemandItem | null>> {
    const data = await http.get<DemandItem | null>(`/plaza/${id}`)
    return http.toApiResponse(data)
  },
  demandDetail(id: number | string): Promise<ApiResponse<DemandItem | null>> {
    return this.detail(id)
  },
  async demandReview(params: { tid: number | string; pass: boolean; remark?: string }): Promise<ApiResponse> {
    const res = await http.post(`/plaza/${params.tid}/review`, {
      pass: params.pass,
      remark: params.remark,
    })
    return http.toApiResponse(res)
  },
}
