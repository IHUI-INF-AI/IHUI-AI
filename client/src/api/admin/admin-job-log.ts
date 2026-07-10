import type { Recordable, ApiResponse, PaginatedData } from '@/types'
import { http } from '@/utils/http'

export interface JobLogRecord {
  jobLogId?: number | string
  jobName?: string
  jobGroup?: string
  invokeTarget?: string
  jobMessage?: string
  status?: string
  [key: string]: unknown
}

export async function jobLogList(params?: Recordable): Promise<ApiResponse<PaginatedData<JobLogRecord>>> {
  const data = await http.get<{ list: JobLogRecord[]; total: number; page: number; pageSize: number }>(
    '/admin/schedule/logs',
    params,
  )
  return http.toApiResponse({
    list: data.list,
    pagination: { total: data.total },
    total: data.total,
  })
}
