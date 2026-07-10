import { create } from 'zustand'

import { getCourses, type Course } from '@/lib/course-api'
import { getExams, type Exam } from '@/lib/exam-api'

export interface Certificate {
  id: string
  title: string
  courseId?: string
  issuedAt?: string
  url?: string
}

interface EducationState {
  courses: Course[]
  currentCourse: Course | null
  learningProgress: Record<string, number>
  exams: Exam[]
  certificates: Certificate[]
  loading: boolean
  error: string | null
  setCourses: (courses: Course[]) => void
  setCurrentCourse: (course: Course | null) => void
  updateProgress: (courseId: string, progress: number) => void
  setExams: (exams: Exam[]) => void
  setCertificates: (certificates: Certificate[]) => void
  fetchMyCourses: () => Promise<void>
}

export const useEducationStore = create<EducationState>((set) => ({
  courses: [],
  currentCourse: null,
  learningProgress: {},
  exams: [],
  certificates: [],
  loading: false,
  error: null,

  setCourses: (courses) => set({ courses }),

  setCurrentCourse: (currentCourse) => set({ currentCourse }),

  updateProgress: (courseId, progress) =>
    set((s) => ({
      learningProgress: { ...s.learningProgress, [courseId]: progress },
      courses: s.courses.map((c) => (c.id === courseId ? { ...c } : c)),
    })),

  setExams: (exams) => set({ exams }),

  setCertificates: (certificates) => set({ certificates }),

  fetchMyCourses: async () => {
    set({ loading: true, error: null })
    const res = await getCourses({ pageSize: 100 })
    if (!res.success) {
      set({ loading: false, error: res.error })
      return
    }
    const courses = res.data.list
    set({ courses, loading: false })
    // 并行拉取考试列表
    const examRes = await getExams({ pageSize: 100 })
    if (examRes.success) {
      set({ exams: examRes.data.list })
    }
  },
}))
