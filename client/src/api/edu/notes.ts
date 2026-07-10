import type { Recordable } from '@/types'
import { http } from '@/utils/http'

export interface LearningNote {
  id?: number | string
  user_id?: string
  title?: string
  content?: string
  is_public?: boolean
  tags?: string[]
  attachments?: Array<{ url: string; name: string; type: 'image' | 'file' }>
  [key: string]: unknown
}

export interface LearningNoteCreate {
  title: string
  content: string
  [key: string]: unknown
}

export const notesApi = {
  async list(params?: Recordable): Promise<{ list: LearningNote[]; total: number }> {
    return http.get<{ list: LearningNote[]; total: number }>('/admin/edu/notes/list', params)
  },
  async create(data: LearningNoteCreate): Promise<LearningNote | null> {
    return http.post<LearningNote | null>('/admin/edu/notes', data as Recordable)
  },
  async update(id: number | string, data: Recordable): Promise<void> {
    await http.put(`/admin/edu/notes/${id}`, data)
  },
  async delete(id: number | string): Promise<void> {
    await http.delete(`/admin/edu/notes/${id}`)
  },
  async detail(id: number | string): Promise<LearningNote | null> {
    return http.get<LearningNote | null>(`/admin/edu/notes/${id}`)
  },
}
