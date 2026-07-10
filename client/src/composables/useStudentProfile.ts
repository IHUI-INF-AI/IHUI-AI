import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export interface StudentProfile {
  id?: string
  name?: string
  avatar?: string
  [key: string]: unknown
}

export interface Course {
  id: string
  name: string
  progress: number
  [key: string]: unknown
}

export interface ExamRecord {
  id: string
  course: string
  score: number
  date: string
  [key: string]: unknown
}

export interface Certificate {
  id: string
  name: string
  issueDate: string
  [key: string]: unknown
}

export interface WrongBookItem {
  id: string
  question: string
  [key: string]: unknown
}

export interface LearningNote {
  id: string
  title: string
  content: string
  [key: string]: unknown
}

export interface OfflineRecord {
  id: string
  title: string
  [key: string]: unknown
}

export interface UploadedCert {
  id: string
  name: string
  url: string
  [key: string]: unknown
}

export interface UploadedPaper {
  id: string
  name: string
  url: string
  [key: string]: unknown
}

export interface DailyStat {
  date: string
  studyTime: number
  minutes?: number
  [key: string]: unknown
}

export interface CategoryStat {
  category: string
  count: number
  [key: string]: unknown
}

export interface SkillRadar {
  indicators: { name: string; max: number }[]
  values: number[]
  [key: string]: unknown
}

export function useStudentProfile(_userId?: string) {
  const profile: Ref<StudentProfile | null> = ref(null)
  const loading = ref(false)
  const error: Ref<string | null> = ref(null)
  const courses: Ref<Course[]> = ref([])
  const examRecords: Ref<ExamRecord[]> = ref([])
  const certificates: Ref<Certificate[]> = ref([])
  const wrongBook: Ref<WrongBookItem[]> = ref([])
  const uploadedCerts: Ref<UploadedCert[]> = ref([])
  const uploadedPapers: Ref<UploadedPaper[]> = ref([])
  const notes: Ref<LearningNote[]> = ref([])
  const offlineRecords: Ref<OfflineRecord[]> = ref([])
  const dailyStats: Ref<DailyStat[]> = ref([])
  const categoryStats: Ref<CategoryStat[]> = ref([])
  const skillRadar: Ref<SkillRadar | null> = ref(null)

  const loadProfile = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  const loadCourses = async (): Promise<void> => {}
  const loadExamRecords = async (): Promise<void> => {}
  const loadCertificates = async (): Promise<void> => {}
  const loadWrongBook = async (): Promise<void> => {}
  const loadUploadedCerts = async (): Promise<void> => {}
  const loadUploadedPapers = async (): Promise<void> => {}
  const loadNotes = async (): Promise<void> => {}
  const loadOfflineRecords = async (): Promise<void> => {}
  const loadDailyStats = async (): Promise<void> => {}
  const loadCategoryStats = async (): Promise<void> => {}
  const loadSkillRadar = async (): Promise<void> => {}

  const loadAll = async (): Promise<void> => {
    loading.value = true
    try {
      await Promise.all([
        loadProfile(),
        loadCourses(),
        loadExamRecords(),
        loadCertificates(),
        loadWrongBook(),
        loadUploadedCerts(),
        loadUploadedPapers(),
        loadNotes(),
        loadOfflineRecords(),
        loadDailyStats(),
        loadCategoryStats(),
        loadSkillRadar(),
      ])
    } finally {
      loading.value = false
    }
  }

  const refresh = async (_section?: string): Promise<void> => {
    await loadAll()
  }

  const totalLearnHours: ComputedRef<number> = computed(() => {
    return dailyStats.value.reduce((sum, s) => sum + (s.studyTime || 0), 0) / 3600
  })

  const averageExamScore: ComputedRef<number> = computed(() => {
    if (examRecords.value.length === 0) return 0
    return examRecords.value.reduce((sum, r) => sum + (r.score || 0), 0) / examRecords.value.length
  })

  const completionRate: ComputedRef<number> = computed(() => {
    if (courses.value.length === 0) return 0
    const completed = courses.value.filter(c => c.progress >= 100).length
    return (completed / courses.value.length) * 100
  })

  const examPassRate: ComputedRef<number> = computed(() => {
    if (examRecords.value.length === 0) return 0
    const passed = examRecords.value.filter(r => r.score >= 60).length
    return (passed / examRecords.value.length) * 100
  })

  const weakSubjects: ComputedRef<string[]> = computed(() => {
    return examRecords.value
      .filter(r => r.score < 60)
      .map(r => r.course)
      .filter((v, i, a) => a.indexOf(v) === i)
  })

  return {
    profile,
    loading,
    error,
    courses,
    examRecords,
    certificates,
    wrongBook,
    uploadedCerts,
    uploadedPapers,
    notes,
    offlineRecords,
    dailyStats,
    categoryStats,
    skillRadar,
    loadProfile,
    loadAll,
    refresh,
    totalLearnHours,
    averageExamScore,
    completionRate,
    examPassRate,
    weakSubjects,
  }
}
