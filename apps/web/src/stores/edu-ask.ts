import { create } from 'zustand'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

export interface AskQuestion {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  answers: number
  views: number
  tags: string[]
  status: 'open' | 'resolved' | 'closed'
  createdAt: string
}

interface EduAskState {
  questions: AskQuestion[]
  total: number
  loading: boolean
  error: string | null
  setQuestions: (questions: AskQuestion[]) => void
  fetchQuestions: (page?: number, pageSize?: number) => Promise<void>
  addQuestion: (q: AskQuestion) => void
}

/** 教育-问答 Store，管理问答列表与提问 */
export const useEduAskStore = create<EduAskState>((set) => ({
  questions: [],
  total: 0,
  loading: false,
  error: null,

  setQuestions: (questions) => set({ questions }),

  fetchQuestions: async (page = 1, pageSize = 10) => {
    set({ loading: true, error: null })
    const res = await fetchApi<PageData<AskQuestion>>(`/edu/ask/list${buildQs({ page, pageSize })}`)
    if (!res.success) {
      set({ loading: false, error: res.error })
      return
    }
    set({ questions: res.data.list, total: res.data.total, loading: false })
  },

  addQuestion: (q) => set((s) => ({ questions: [q, ...s.questions], total: s.total + 1 })),
}))
