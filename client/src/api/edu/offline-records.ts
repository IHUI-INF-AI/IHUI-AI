/**
 * 线下学习记录补录 API（模块 D）
 *
 * 用户手动补录线下培训/自学时长，并入学习统计。
 */
import request from '@/utils/request'
import type { EduBaseResponse, EduPaginatedResponse } from './index'
import { offlineRecordsApiMock } from '@/api/mock/offline-records-mock'

export type OfflineActivityType = 'training' | 'self_study' | 'practice' | 'reading' | 'other'

export interface OfflineRecord {
  id: number
  user_id: string
  record_date: string
  duration_minutes: number
  activity_type: OfflineActivityType
  title: string
  description?: string
  proof_url?: string
  create_time: string
}

export type OfflineRecordCreate = Omit<OfflineRecord, 'id' | 'user_id' | 'create_time'>

const USE_MOCK = import.meta.env.VITE_USE_EDU_MOCK !== 'false'

export const offlineRecordsApi = {
  list: (params?: { page?: number; size?: number; start_date?: string; end_date?: string; activity_type?: OfflineActivityType }) =>
    USE_MOCK
      ? offlineRecordsApiMock.list(params)
      : request.get<EduBaseResponse<EduPaginatedResponse<OfflineRecord>>>('/api/v1/edu/learn/offline-records', { params }),

  create: (data: OfflineRecordCreate) =>
    USE_MOCK
      ? offlineRecordsApiMock.create(data)
      : request.post<EduBaseResponse<OfflineRecord>>('/api/v1/edu/learn/offline-records', data),

  update: (id: number, data: Partial<OfflineRecord>) =>
    USE_MOCK
      ? offlineRecordsApiMock.update(id, data)
      : request.put<EduBaseResponse<OfflineRecord>>(`/api/v1/edu/learn/offline-records/${id}`, data),

  delete: (id: number) =>
    USE_MOCK
      ? offlineRecordsApiMock.delete(id)
      : request.delete<EduBaseResponse<void>>(`/api/v1/edu/learn/offline-records/${id}`),
}
