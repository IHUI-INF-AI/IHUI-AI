import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface FaqRecord {
  faqId?: number | string
  question?: string
  answer?: string
  status?: string
  [key: string]: unknown
}

export async function getAdminFAQs(params?: Recordable): Promise<ApiResponse<PaginatedData<FaqRecord>>> {
  const data = await http.get<{ list: FaqRecord[] }>('/admin/help/articles', params)
  const list = data.list ?? []
  return http.toApiResponse({
    list,
    pagination: { total: list.length },
    total: list.length,
  })
}
