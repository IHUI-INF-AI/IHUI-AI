/**
 * 学员档案数据聚合 composable
 *
 * 统一从 edu/index.ts + mock API 拉取所有学习数据，提供响应式状态 + 计算属性。
 *
 * C0 修复（2026-07-02）：
 * - B-1: courses ref 永不赋值 → loadAll 追加 listCourses + getCompletion 数据源
 * - B-2: refresh 仅支持 4 section → 扩展为 7 section（+courses/wrongbook/ai-report）
 * - B-3: 非单例 → 改为模块级 singleton
 * - B-4: loadAll 无去重 → inflight Promise 复用
 * - B-5: wrongBook 类型不安全 → unknown[] 改为 EduWrongBookItem[]
 *
 * 用法：const profile = useStudentProfile(); await profile.loadAll()
 */
import { ref, computed } from 'vue'
import { memberApi, learnApi, examApi } from '@/api/edu'
import { notesApi } from '@/api/edu/notes'
import { offlineRecordsApi } from '@/api/edu/offline-records'
import { uploadedCertsApi } from '@/api/edu/uploaded-certs'
import { uploadedPapersApi } from '@/api/edu/uploaded-papers'
import { learnStatsApi } from '@/api/edu/stats'
import type {
  EduMember,
  EduCertificate,
  EduExamRecord,
  EduCourse,
  EduLearnRecord,
  EduWrongBookItem,
  EduBaseResponse,
  EduPaginatedResponse,
} from '@/api/edu'
import type { LearningNote } from '@/api/edu/notes'
import type { OfflineRecord } from '@/api/edu/offline-records'
import type { UploadedCert } from '@/api/edu/uploaded-certs'
import type { UploadedPaper } from '@/api/edu/uploaded-papers'
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

/** refresh 支持的 section 类型（C0 B-2：从 4 个扩展到 8 个，PR-E E6 新增 papers） */
export type ProfileSection =
  | 'notes'
  | 'offline'
  | 'certs'
  | 'exams'
  | 'courses'
  | 'wrongbook'
  | 'ai-report'
  | 'papers'

// ============================================================================
// C0 B-3：模块级 singleton（避免页面切换重复创建 ref + 重复请求 API）
// ============================================================================
let singleton: ReturnType<typeof createStudentProfile> | null = null

// C0 B-4：inflight Promise 复用（避免并发 loadAll 产生竞态）
let inflight: Promise<void> | null = null

/**
 * 重置学员档案 singleton（登出时调用，防止下个用户看到上个用户数据）
 * PR-F F3 在 auth.logout 调用
 */
export function resetStudentProfile() {
  singleton = null
  inflight = null
}

/** 对外暴露的入口：返回 singleton（C0 B-3） */
export function useStudentProfile() {
  if (!singleton) singleton = createStudentProfile()
  return singleton
}

/** 实际创建实例的内部函数（C0 B-3：从 export 改为内部） */
function createStudentProfile() {
  const profile = ref<EduMember | null>(null)
  const learnStat = ref<LearnStat | null>(null)
  const courses = ref<CourseWithProgress[]>([])
  const examRecords = ref<EduExamRecord[]>([])
  const certificates = ref<EduCertificate[]>([])
  const homeworks = ref<unknown[]>([])
  // C0 B-5：wrongBook 从 unknown[] 改为 EduWrongBookItem[]
  const wrongBook = ref<EduWrongBookItem[]>([])
  const notes = ref<LearningNote[]>([])
  const offlineRecords = ref<OfflineRecord[]>([])
  const uploadedCerts = ref<UploadedCert[]>([])
  // PR-E E6：新增 uploadedPapers ref
  const uploadedPapers = ref<UploadedPaper[]>([])
  const dailyStats = ref<DailyStat[]>([])
  const categoryStats = ref<CategoryStat[]>([])
  const skillRadar = ref<SkillRadarStat[]>([])

  const loading = ref(false)
  const error = ref<Error | null>(null)

  // C0 B-4：loadAll 加 inflight 去重锁
  async function loadAll() {
    if (inflight) return inflight
    loading.value = true
    error.value = null
    inflight = (async () => {
      try {
        const results = await Promise.allSettled([
          memberApi.me(),
          learnApi.myCertificates(),
          examApi.myExams({ page: 1, size: 50 }),
          examApi.myWrongBook({ page: 1, size: 50 }),
          notesApi.list({ page: 1, size: 100 }),
          offlineRecordsApi.list({ page: 1, size: 100 }),
          uploadedCertsApi.list({ page: 1, size: 100 }),
          // PR-E E6：新增 uploadedPapers 数据源
          uploadedPapersApi.list({ page: 1, size: 100 }),
          learnStatsApi.daily({ days: 30 }),
          learnStatsApi.byCategory(),
          learnStatsApi.skillRadar(),
          // C0 B-1：新增 courses 数据源
          learnApi.listCourses({ page: 1, size: 50, is_published: true }),
        ])

        const [
          profileRes,
          certsRes,
          examsRes,
          wrongRes,
          notesRes,
          offlineRes,
          uploadedCertsRes,
          uploadedPapersRes,
          dailyRes,
          catRes,
          radarRes,
          coursesRes,
        ] = results

        profile.value = unwrap(profileRes as SettledResult<EduMember>)
        certificates.value = unwrap(certsRes as SettledResult<EduCertificate[]>) ?? []
        examRecords.value = unwrapPaginated(examsRes as SettledResult<EduPaginatedResponse<EduExamRecord>>)
        wrongBook.value = unwrapPaginated(wrongRes as SettledResult<EduPaginatedResponse<EduWrongBookItem>>)
        notes.value = unwrapPaginated(notesRes as SettledResult<EduPaginatedResponse<LearningNote>>)
        offlineRecords.value = unwrapPaginated(offlineRes as SettledResult<EduPaginatedResponse<OfflineRecord>>)
        uploadedCerts.value = unwrapPaginated(uploadedCertsRes as SettledResult<EduPaginatedResponse<UploadedCert>>)
        // PR-E E6：uploadedPapers 赋值
        uploadedPapers.value = unwrapPaginated(uploadedPapersRes as SettledResult<EduPaginatedResponse<UploadedPaper>>)
        dailyStats.value = unwrap(dailyRes as SettledResult<DailyStat[]>) ?? []
        categoryStats.value = unwrap(catRes as SettledResult<CategoryStat[]>) ?? []
        skillRadar.value = unwrap(radarRes as SettledResult<SkillRadarStat[]>) ?? []

        // C0 B-1：courses 拼装（listCourses + getCompletion N+1，Promise.allSettled 降级）
        const courseList = unwrapPaginated(coursesRes as SettledResult<EduPaginatedResponse<EduCourse>>)
        if (courseList.length > 0) {
          const completionResults = await Promise.allSettled(
            courseList.map((c) => learnApi.getCompletion(c.id))
          )
          courses.value = courseList.map((course, idx) => {
            const r = completionResults[idx]
            const completion =
              r.status === 'fulfilled'
                ? (r.value as unknown as EduBaseResponse<{ completion_percent: number }>)?.data
                    ?.completion_percent ?? 0
                : 0
            return { course, completion, progress: [] }
          })
        } else {
          courses.value = []
        }

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
        inflight = null
      }
    })()
    return inflight
  }

  // C0 B-2：refresh 从 4 个 section 扩展到 7 个
  async function refresh(section: ProfileSection) {
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
      } else if (section === 'courses') {
        // C0 B-2：新增 courses 刷新
        const res = await learnApi.listCourses({ page: 1, size: 50, is_published: true })
        const courseList =
          (res as unknown as EduBaseResponse<EduPaginatedResponse<EduCourse>>)?.data?.items ?? []
        if (courseList.length > 0) {
          const completionResults = await Promise.allSettled(
            courseList.map((c) => learnApi.getCompletion(c.id))
          )
          courses.value = courseList.map((course, idx) => {
            const r = completionResults[idx]
            const completion =
              r.status === 'fulfilled'
                ? (r.value as unknown as EduBaseResponse<{ completion_percent: number }>)?.data
                    ?.completion_percent ?? 0
                : 0
            return { course, completion, progress: [] }
          })
        } else {
          courses.value = []
        }
      } else if (section === 'wrongbook') {
        // C0 B-2：新增 wrongbook 刷新
        const res = await examApi.myWrongBook({ page: 1, size: 50 })
        wrongBook.value =
          (res as unknown as EduBaseResponse<EduPaginatedResponse<EduWrongBookItem>>)?.data?.items ?? []
      } else if (section === 'ai-report') {
        // C0 B-2：ai-report 占位（PR-D 实现，此处无数据源需要刷新，保留接口一致性）
        // AI 报告由 useAiReportEngine 本地生成或 aiReportApi 拉取，不在此刷新
      } else if (section === 'papers') {
        // PR-E E6：新增 papers 刷新
        const res = await uploadedPapersApi.list({ page: 1, size: 100 })
        uploadedPapers.value = (res as EduBaseResponse<EduPaginatedResponse<UploadedPaper>>)?.data?.items ?? []
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

  // C0 B-5：weakSubjects 使用 EduWrongBookItem 类型（不再需要 as 强转）
  const weakSubjects = computed<string[]>(() => {
    const categoryCount = new Map<string, number>()
    for (const item of wrongBook.value) {
      const category =
        item.category || item.category_name || item.question?.category || item.tags?.split(',')[0]?.trim() || '其他'
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
    uploadedPapers,
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
