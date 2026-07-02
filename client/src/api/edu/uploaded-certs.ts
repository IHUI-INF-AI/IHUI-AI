/**
 * 历史证书/成绩单扫描件上传 API（模块 E）
 *
 * 用户上传线下获得的证书照片/PDF，作为学习成果展示（不进入考试系统，仅档案展示）。
 */
import request from '@/utils/request'
import type { EduBaseResponse, EduPaginatedResponse } from './index'
import { uploadedCertsApiMock } from '@/api/mock/uploaded-certs-mock'

export type UploadedCertType = 'certificate' | 'transcript' | 'diploma' | 'other'

export interface UploadedCert {
  id: number
  user_id: string
  title: string
  issuer: string
  issue_date: string
  expiry_date?: string
  cert_type: UploadedCertType
  file_url: string
  description?: string
  create_time: string
}

export type UploadedCertCreate = Omit<UploadedCert, 'id' | 'user_id' | 'create_time'>

const USE_MOCK = import.meta.env.VITE_USE_EDU_MOCK !== 'false'

export const uploadedCertsApi = {
  list: (params?: { page?: number; size?: number; cert_type?: UploadedCertType }) =>
    USE_MOCK
      ? uploadedCertsApiMock.list(params)
      : request.get<EduBaseResponse<EduPaginatedResponse<UploadedCert>>>('/api/v1/edu/learn/uploaded-certs', { params }),

  create: (data: UploadedCertCreate) =>
    USE_MOCK
      ? uploadedCertsApiMock.create(data)
      : request.post<EduBaseResponse<UploadedCert>>('/api/v1/edu/learn/uploaded-certs', data),

  update: (id: number, data: Partial<UploadedCert>) =>
    USE_MOCK
      ? uploadedCertsApiMock.update(id, data)
      : request.put<EduBaseResponse<UploadedCert>>(`/api/v1/edu/learn/uploaded-certs/${id}`, data),

  delete: (id: number) =>
    USE_MOCK
      ? uploadedCertsApiMock.delete(id)
      : request.delete<EduBaseResponse<void>>(`/api/v1/edu/learn/uploaded-certs/${id}`),
}
