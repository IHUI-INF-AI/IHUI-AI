/**
 * 考试试卷上传 API（模块 E - PR-E E1）
 *
 * 学员上传试卷扫描件（单元测/期中/期末/模拟考/竞赛/其他），作为学习档案展示与复盘用。
 * 与 uploaded-certs 模式一致：CRUD + 分页 + 类型筛选。
 */
import request from '@/utils/request'
import type { EduBaseResponse, EduPaginatedResponse } from './index'
import { uploadedPapersApiMock } from '@/api/mock/uploaded-papers-mock'

/** 试卷类型 */
export type PaperType =
  | 'unit_test'
  | 'midterm'
  | 'final'
  | 'mock_exam'
  | 'competition'
  | 'other'

/** 试卷科目 */
export type PaperSubject =
  | 'chinese'
  | 'math'
  | 'english'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'history'
  | 'geography'
  | 'politics'
  | 'other'

export interface UploadedPaper {
  id: number
  user_id: string
  title: string
  paper_type: PaperType
  subject: PaperSubject
  exam_date: string
  score?: number
  full_score?: number
  file_url: string
  description?: string
  create_time: string
}

export type UploadedPaperCreate = Omit<UploadedPaper, 'id' | 'user_id' | 'create_time'>

const USE_MOCK = import.meta.env.VITE_USE_EDU_MOCK !== 'false'

export const uploadedPapersApi = {
  list: (params?: {
    page?: number
    size?: number
    paper_type?: PaperType
    subject?: PaperSubject
  }) =>
    USE_MOCK
      ? uploadedPapersApiMock.list(params)
      : request.get<EduBaseResponse<EduPaginatedResponse<UploadedPaper>>>(
          '/api/v1/edu/learn/uploaded-papers',
          { params },
        ),

  create: (data: UploadedPaperCreate) =>
    USE_MOCK
      ? uploadedPapersApiMock.create(data)
      : request.post<EduBaseResponse<UploadedPaper>>(
          '/api/v1/edu/learn/uploaded-papers',
          data,
        ),

  update: (id: number, data: Partial<UploadedPaper>) =>
    USE_MOCK
      ? uploadedPapersApiMock.update(id, data)
      : request.put<EduBaseResponse<UploadedPaper>>(
          `/api/v1/edu/learn/uploaded-papers/${id}`,
          data,
        ),

  delete: (id: number) =>
    USE_MOCK
      ? uploadedPapersApiMock.delete(id)
      : request.delete<EduBaseResponse<void>>(
          `/api/v1/edu/learn/uploaded-papers/${id}`,
        ),
}
