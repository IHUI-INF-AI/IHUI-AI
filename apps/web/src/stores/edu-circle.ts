import { create } from 'zustand'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

export interface CirclePost {
  id: string
  circleId: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  content: string
  images: string[]
  likes: number
  comments: number
  liked: boolean
  createdAt: string
}

export interface Circle {
  id: string
  name: string
  cover: string | null
  description: string
  memberCount: number
  postCount: number
  joined: boolean
}

interface EduCircleState {
  circles: Circle[]
  posts: CirclePost[]
  currentCircleId: string | null
  loading: boolean
  error: string | null
  setCircles: (circles: Circle[]) => void
  setPosts: (posts: CirclePost[]) => void
  setCurrentCircle: (id: string | null) => void
  fetchCircles: () => Promise<void>
  fetchPosts: (circleId: string, page?: number) => Promise<void>
}

/** 教育-圈子 Store，管理圈子列表与圈内动态 */
export const useEduCircleStore = create<EduCircleState>((set) => ({
  circles: [],
  posts: [],
  currentCircleId: null,
  loading: false,
  error: null,

  setCircles: (circles) => set({ circles }),
  setPosts: (posts) => set({ posts }),
  setCurrentCircle: (currentCircleId) => set({ currentCircleId }),

  fetchCircles: async () => {
    set({ loading: true, error: null })
    const res = await fetchApi<Circle[]>('/edu/circles')
    if (!res.success) {
      set({ loading: false, error: res.error })
      return
    }
    set({ circles: res.data, loading: false })
  },

  fetchPosts: async (circleId, page = 1) => {
    set({ loading: true, error: null })
    const res = await fetchApi<PageData<CirclePost>>(
      `/edu/circles/${circleId}/posts${buildQs({ page })}`,
    )
    if (!res.success) {
      set({ loading: false, error: res.error })
      return
    }
    set({ posts: res.data.list, currentCircleId: circleId, loading: false })
  },
}))
