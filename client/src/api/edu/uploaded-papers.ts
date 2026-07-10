import type { Recordable } from '@/types'
import { http } from '@/utils/http'

export interface UploadedPaper {
  id?: number | string
  user_id?: string
  paper_name?: string
  [key: string]: unknown
}

export const uploadedPapersApi = {
  async list(params?: Recordable): Promise<{ list: UploadedPaper[]; total: number }> {
    return http.get<{ list: UploadedPaper[]; total: number }>('/admin/edu/uploaded-papers/list', params)
  },
  async create(data: Recordable): Promise<UploadedPaper | null> {
    return http.post<UploadedPaper | null>('/admin/edu/uploaded-papers', data)
  },
  async delete(id: number | string): Promise<void> {
    await http.delete(`/admin/edu/uploaded-papers/${id}`)
  },
  async detail(id: number | string): Promise<UploadedPaper | null> {
    return http.get<UploadedPaper | null>(`/admin/edu/uploaded-papers/${id}`)
  },
}
