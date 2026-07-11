import { create } from 'zustand'

import { getLearnCourses, getMyLearnCourses, type LearnCourse } from '@/lib/learn-api'

interface EduLearnState {
  courses: LearnCourse[]
  myCourses: LearnCourse[]
  currentCourse: LearnCourse | null
  loading: boolean
  error: string | null
  setCourses: (courses: LearnCourse[]) => void
  setMyCourses: (courses: LearnCourse[]) => void
  setCurrentCourse: (course: LearnCourse | null) => void
  fetchCourses: (category?: string) => Promise<void>
  fetchMyCourses: () => Promise<void>
}

/** 教育-学习 Store，管理课程列表与我的课程 */
export const useEduLearnStore = create<EduLearnState>((set) => ({
  courses: [],
  myCourses: [],
  currentCourse: null,
  loading: false,
  error: null,

  setCourses: (courses) => set({ courses }),
  setMyCourses: (myCourses) => set({ myCourses }),
  setCurrentCourse: (currentCourse) => set({ currentCourse }),

  fetchCourses: async (category) => {
    set({ loading: true, error: null })
    const res = await getLearnCourses({ pageSize: 100, ...(category ? { category } : {}) })
    if (!res.success) {
      set({ loading: false, error: res.error })
      return
    }
    set({ courses: res.data.list, loading: false })
  },

  fetchMyCourses: async () => {
    set({ loading: true, error: null })
    const res = await getMyLearnCourses({ pageSize: 100 })
    if (!res.success) {
      set({ loading: false, error: res.error })
      return
    }
    set({ myCourses: res.data.list, loading: false })
  },
}))
