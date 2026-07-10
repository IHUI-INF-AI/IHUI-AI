import type { Recordable } from '@/types'
import { http } from '@/utils/http'

export type OfflineActivityType = string

export interface OfflineRecord {
  id?: number | string
  user_id?: string
  activity_type?: OfflineActivityType
  title?: string
  record_date?: string
  duration_minutes?: number
  description?: string
  proof_url?: string
  [key: string]: unknown
}

export interface OfflineRecordCreate {
  activity_type: OfflineActivityType
  title?: string
  record_date?: string
  duration_minutes?: number
  description?: string
  proof_url?: string
  [key: string]: unknown
}

export const offlineRecordsApi = {
  async list(params?: Recordable): Promise<{ list: OfflineRecord[]; total: number }> {
    return http.get<{ list: OfflineRecord[]; total: number }>('/admin/edu/offline-records/list', params)
  },
  async create(data: OfflineRecordCreate): Promise<OfflineRecord | null> {
    return http.post<OfflineRecord | null>('/admin/edu/offline-records', data as Recordable)
  },
  async update(id: number | string, data: Recordable): Promise<void> {
    await http.put(`/admin/edu/offline-records/${id}`, data)
  },
  async delete(id: number | string): Promise<void> {
    await http.delete(`/admin/edu/offline-records/${id}`)
  },
  async detail(id: number | string): Promise<OfflineRecord | null> {
    return http.get<OfflineRecord | null>(`/admin/edu/offline-records/${id}`)
  },
}
