import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface NoticeRecord {
  noticeId?: number | string
  noticeTitle?: string
  noticeType?: string
  noticeContent?: string
  status?: string
  [key: string]: unknown
}

export async function noticeList(params?: Recordable): Promise<ApiResponse<PaginatedData<NoticeRecord>>> {
  const data = await http.get<{ list: NoticeRecord[]; total: number; page: number; pageSize: number }>(
    '/admin/messages/announcements',
    params,
  )
  return http.toApiResponse({
    list: data.list,
    pagination: { total: data.total },
    total: data.total,
  })
}
export async function noticeCreate(data: Recordable): Promise<ApiResponse> {
  const res = await http.post<{ announcement: NoticeRecord }>('/admin/messages/announcements', data)
  return http.toApiResponse(res.announcement)
}
