/**
 * 学员档案数据聚合 composable
 *
 * 统一从 edu/index.ts + mock API 拉取所有学习数据，提供响应式状态 + 计算属性。
 * 用法：const profile = useStudentProfile(); await profile.loadAll()
 */
import { ref, computed } from 'vue'
import { memberApi, learnApi, examApi } from '@/api/edu'
import { notesApi } from '@/api/edu/notes'
import { offlineRecordsApi } from '@/api/edu/offline-records'
import { uploadedCertsApi } from '@/api/edu/uploaded-certs'
import { learnStatsApi } from '@/api/edu/stats'
import type {
  EduMember,
  EduCertificate,
  EduExamRecord,
  EduCourse,
  EduLearnRecord,
  EduBaseResponse,
  EduPaginatedResponse,
} from '@/api/edu'
import type { LearningNote } from '@/api/edu/notes'
import type { OfflineRecord } from '@/api/edu/offline-records'
import type { UploadedCert } from '@/api/edu/uploaded-certs'
import type { DailyStat, CategoryStat, SkillRadarStat } from '@/api/edu/stats'

export interface LearnStat {
  totalDays: number
  totalMinutes: number
  continuousDays: number
  todayMinutes: number
}

export interface CourseWithProgress {
  course: EduCourse
  completion: number
  progress: EduLearnRecord[]
}

type SettledResult<T> = PromiseSettledResult<EduBaseResponse<T>>

function unwrap<T>(result: SettledResult<T>): T | null {
  if (result.status === 'fulfilled') {
    return (result.value as EduBaseResponse<T>)?.data ?? null
  }
  return null
}

function unwrapPaginated<T>(result: SettledResult<EduPaginatedResponse<T>>): T[] {
  if (result.status === 'fulfilled') {
    const data = (result.value as EduBaseResponse<EduPaginatedResponse<T>>)?.data
    return data?.items ?? []
  }
  return []
}

export function useStudentProfile() {
  const profile = ref<EduMember | null>(null)
  const learnStat = ref<LearnStat | null>(null)
  const courses = ref<CourseWithProgress[]>([])
  const examRecords = ref<EduExamRecord[]>([])
  const certificates = ref<EduCertificate[]>([])
  const homeworks = ref<unknown[]>([])
  const wrongBook = ref<unknown[]>([])
  const notes = ref<LearningNote[]>([])
  const offlineRecords = ref<OfflineRecord[]>([])
  const uploadedCerts = ref<UploadedCert[]>([])
  const dailyStats = ref<DailyStat[]>([])
  const categoryStats = ref<CategoryStat[]>([])
  const skillRadar = ref<SkillRadarStat[]>([])

  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function loadAll() {
    loading.value = true
    error.value = null
    try {
      const results = await Promise.allSettled([
        memberApi.me(),
        learnApi.myCertificates(),
        examApi.myExams({ page: 1, size: 50 }),
        examApi.myWrongBook({ page: 1, size: 50 }),
        notesApi.list({ page: 1, size: 100 }),
        offlineRecordsApi.list({ page: 1, size: 100 }),
        uploadedCertsApi.list({ page: 1, size: 100 }),
        learnStatsApi.daily({ days: 30 }),
        learnStatsApi.byCategory(),
        learnStatsApi.skillRadar(),
      ])

      const [
        profileRes,
        certsRes,
        examsRes,
        wrongRes,
        notesRes,
        offlineRes,
        uploadedCertsRes,
        dailyRes,
        catRes,
        radarRes,
      ] = results

      profile.value = unwrap(profileRes as SettledResult<EduMember>)
      certificates.value = unwrap(certsRes as SettledResult<EduCertificate[]>) ?? []
      examRecords.value = unwrapPaginated(examsRes as SettledResult<EduPaginatedResponse<EduExamRecord>>)
      wrongBook.value = unwrapPaginated(wrongRes as SettledResult<EduPaginatedResponse<Record<string, unknown>>>)
      notes.value = unwrapPaginated(notesRes as SettledResult<EduPaginatedResponse<LearningNote>>)
      offlineRecords.value = unwrapPaginated(offlineRes as SettledResult<EduPaginatedResponse<OfflineRecord>>)
      uploadedCerts.value = unwrapPaginated(uploadedCertsRes as SettledResult<EduPaginatedResponse<UploadedCert>>)
      dailyStats.value = unwrap(dailyRes as SettledResult<DailyStat[]>) ?? []
      categoryStats.value = unwrap(catRes as SettledResult<CategoryStat[]>) ?? []
      skillRadar.value = unwrap(radarRes as SettledResult<SkillRadarStat[]>) ?? []

      // 从 dailyStats 派生 learnStat
      if (dailyStats.value.length > 0) {
        const totalMinutes = dailyStats.value.reduce((s, d) => s + d.minutes, 0)
        const today = new Date().toISOString().slice(0, 10)
        const todayItem = dailyStats.value.find((d) => d.date === today)
        let continuousDays = 0
        const sorted = [...dailyStats.value].sort((a, b) => b.date.localeCompare(a.date))
        for (const item of sorted) {
          if (item.minutes > 0) {
            continuousDays++
          } else {
            break
          }
        }
        learnStat.value = {
          totalDays: dailyStats.value.filter((d) => d.minutes > 0).length,
          totalMinutes,
          continuousDays,
          todayMinutes: todayItem?.minutes ?? 0,
        }
      }
    } catch (e) {
      error.value = e as Error
      console.error('[useStudentProfile] loadAll 失败', e)
    } finally {
      loading.value = false
    }
  }

  async function refresh(section: 'notes' | 'offline' | 'certs' | 'exams') {
    try {
      if (section === 'notes') {
        const res = await notesApi.list({ page: 1, size: 100 })
        notes.value = (res as EduBaseResponse<EduPaginatedResponse<LearningNote>>)?.data?.items ?? []
      } else if (section === 'offline') {
        const res = await offlineRecordsApi.list({ page: 1, size: 100 })
        offlineRecords.value = (res as EduBaseResponse<EduPaginatedResponse<OfflineRecord>>)?.data?.items ?? []
      } else if (section === 'certs') {
        const res = await uploadedCertsApi.list({ page: 1, size: 100 })
        uploadedCerts.value = (res as EduBaseResponse<EduPaginatedResponse<UploadedCert>>)?.data?.items ?? []
      } else if (section === 'exams') {
        const res = await examApi.myExams({ page: 1, size: 50 })
        examRecords.value =
          (res as unknown as EduBaseResponse<EduPaginatedResponse<EduExamRecord>>)?.data?.items ?? []
      }
    } catch (e) {
      console.error(`[useStudentProfile] refresh ${section} 失败`, e)
    }
  }

  const totalLearnHours = computed(() => {
    const online = learnStat.value?.totalMinutes ?? 0
    const offline = offlineRecords.value.reduce((s, r) => s + r.duration_minutes, 0)
    return Math.floor((online + offline) / 60)
  })

  const averageExamScore = computed(() => {
    const scored = examRecords.value.filter((r) => r.score != null)
    if (scored.length === 0) return 0
    return Math.floor(scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length)
  })

  const completionRate = computed(() => {
    if (courses.value.length === 0) return 0
    const completed = courses.value.filter((c) => c.completion >= 100).length
    return Math.floor((completed / courses.value.length) * 100)
  })

  const examPassRate = computed(() => {
    if (examRecords.value.length === 0) return 0
    const passed = examRecords.value.filter((r) => r.is_passed).length
    return Math.floor((passed / examRecords.value.length) * 100)
  })

  const weakSubjects = computed<string[]>(() => {
    const categoryCount = new Map<string, number>()
    for (const item of wrongBook.value as Array<Record<string, unknown>>) {
      const category = (item.category as string) || (item.tag as string) || '其他'
      categoryCount.set(category, (categoryCount.get(category) ?? 0) + 1)
    }
    return Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)
  })

  return {
    profile,
    learnStat,
    courses,
    examRecords,
    certificates,
    homeworks,
    wrongBook,
    notes,
    offlineRecords,
    uploadedCerts,
    dailyStats,
    categoryStats,
    skillRadar,
    loading,
    error,
    loadAll,
    refresh,
    totalLearnHours,
    averageExamScore,
    completionRate,
    examPassRate,
    weakSubjects,
  }
}
