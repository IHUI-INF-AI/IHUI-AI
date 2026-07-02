/**
 * 学习笔记 API（模块 C）
 *
 * 后端未实现前走 mock，后端就绪后通过 VITE_USE_EDU_MOCK=false 切换。
 * 附件上传走现有 @/api/upload.ts 的 uploadSingle，不新建上传通道。
 */
import request from '@/utils/request'
import type { EduBaseResponse, EduPaginatedResponse } from './index'
import { notesApiMock } from '@/api/mock/notes-mock'

export interface LearningNote {
  id: number
  user_id: string
  course_id?: number
  section_id?: number
  title: string
  content: string
  attachments?: Array<{ url: string; name: string; type: 'image' | 'file' }>
  tags?: string[]
  is_public: boolean
  create_time: string
  update_time: string
}

export type LearningNoteCreate = Omit<LearningNote, 'id' | 'user_id' | 'create_time' | 'update_time'>

const USE_MOCK = import.meta.env.VITE_USE_EDU_MOCK !== 'false'

export const notesApi = {
  list: (params?: { page?: number; size?: number; course_id?: number; keyword?: string }) =>
    USE_MOCK
      ? notesApiMock.list(params)
      : request.get<EduBaseResponse<EduPaginatedResponse<LearningNote>>>('/api/v1/edu/learn/notes', { params }),

  create: (data: LearningNoteCreate) =>
    USE_MOCK
      ? notesApiMock.create(data)
      : request.post<EduBaseResponse<LearningNote>>('/api/v1/edu/learn/notes', data),

  update: (id: number, data: Partial<LearningNote>) =>
    USE_MOCK
      ? notesApiMock.update(id, data)
      : request.put<EduBaseResponse<LearningNote>>(`/api/v1/edu/learn/notes/${id}`, data),

  delete: (id: number) =>
    USE_MOCK
      ? notesApiMock.delete(id)
      : request.delete<EduBaseResponse<void>>(`/api/v1/edu/learn/notes/${id}`),
}
