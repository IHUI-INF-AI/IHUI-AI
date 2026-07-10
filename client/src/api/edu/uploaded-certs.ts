import type { Recordable } from '@/types'
import { http } from '@/utils/http'

export type UploadedCertType = string

export interface UploadedCertCreate {
  cert_type?: UploadedCertType
  [key: string]: unknown
}

export const uploadedCertsApi = {
  async list(params?: Recordable): Promise<{ list: Recordable[]; total: number }> {
    return http.get<{ list: Recordable[]; total: number }>('/admin/edu/uploaded-certs/list', params)
  },
  async create(data: UploadedCertCreate): Promise<Recordable | null> {
    return http.post<Recordable | null>('/admin/edu/uploaded-certs', data as Recordable)
  },
  async delete(id: number | string): Promise<void> {
    await http.delete(`/admin/edu/uploaded-certs/${id}`)
  },
  async detail(id: number | string): Promise<Recordable | null> {
    return http.get<Recordable | null>(`/admin/edu/uploaded-certs/${id}`)
  },
}
