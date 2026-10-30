// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getEduClasses,
  getEduTerms,
  getHomeworkSubmissionStats,
  getHomeworkSubmissions,
  gradeHomeworkSubmission,
  type EduClassItem,
  type EduTermItem,
  type HomeworkStatsResult,
  type HomeworkSubmissionItem,
} from '@ihui/api-client'
import {
  EduHomeworkScreen as SharedEduHomeworkScreen,
  HOMEWORK_STATUS_LABEL_KEYS,
  type HomeworkClassOption,
  type HomeworkStatsView,
  type HomeworkSubmissionView,
  type HomeworkTermOption,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'eduHomework'

/** 及格线 60:web 同档 `score >= 60 ? text-green-600 : text-red-600`
 *  (apps/web/app/(main)/edu/edu-management/homework/PageClient.tsx:494) */
const PASS_SCORE = 60

/**
 * RN 端「作业管理」薄壳 —— 承载 web /edu/edu-management/homework。渲染全部委托共享屏,本文件只管:
 *  - 取数链 term → class → stats + submissions(endpoints/edu-management-homework.ts 头注有逐条后端证据:
 *    apps/api/src/routes/edu-ai-management.ts:859-870 / :947-958 / :3705-3724 / :3774-3805),
 *  - 默认选中:当前学期优先(web PageClient.tsx:212-217)+ 该学期首班(web :227-231),
 *  - 状态筛选做成**客户端过滤**(后端 list schema 只认 homeworkId/classId,schema :546-549,
 *    web 传的 status 被丢弃 ⇒ 服务端过滤不存在,不假装有),
 *  - 批量文案:学期名后缀 currentTermTag、班级名后缀 grade(web :336-337 / :357-359),
 *  - 提交时间格式化(web 同参 month short / day numeric / hour / minute,:473-478),
 *  - 批改 PUT :id/grade(score 取整 0..100,schema :559-562),成功后就地刷新统计与列表,
 *  - 错误统一 t('common.loadFailed')(规则要求;后端 403 无教务权限与 401 未登录都归此态)。
 * 契约差:web 表头「学生姓名」读 s.studentName,表里没有该列(schema :523-548 只有 studentId),
 * 线上恒空白 —— 这里以 studentId 前 8 位兜底,不伪造姓名。
 */
export function EduHomeworkScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [terms, setTerms] = useState<HomeworkTermOption[]>([])
  const [classes, setClasses] = useState<HomeworkClassOption[]>([])
  const [selectedTermId, setSelectedTermId] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [rows, setRows] = useState<HomeworkSubmissionView[]>([])
  const [stats, setStats] = useState<HomeworkStatsView | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [gradeSaving, setGradeSaving] = useState(false)
  const [gradeError, setGradeError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const fmtSubmittedAt = useMemo(
    () => (value: string | null): string => {
      if (!value) return '-'
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return '-'
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const statusText = useCallback(
    (status: string): string => {
      const key = HOMEWORK_STATUS_LABEL_KEYS[status]
      // 未知状态码原样回显,不吞数据(web submissionStatusLabel 同口径,PageClient.tsx:304-307)
      return key ? t(`${NS}.${key}`) : status
    },
    [t],
  )

  const toView = useCallback(
    (item: HomeworkSubmissionItem): HomeworkSubmissionView => ({
      id: item.id,
      // 后端无 studentName 列 ⇒ 用 studentId 前 8 位兜底(见头注契约差)
      studentText: item.studentId.slice(0, 8),
      contentText: item.content || '-',
      submittedAtText: fmtSubmittedAt(item.submittedAt),
      status: item.status,
      statusText: statusText(item.status),
      scoreText: item.score === null ? '-' : String(item.score),
      scorePass: (item.score ?? 0) >= PASS_SCORE,
      commentText: item.comment || '-',
      gradable: item.status !== 'graded',
    }),
    [fmtSubmittedAt, statusText],
  )

  /* ── 学期 ── */
  const loadTerms = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await getEduTerms()
      if (!res.success || !res.data) {
        setError(t('common.loadFailed'))
        return
      }
      const list = res.data.list ?? []
      setTerms(
        list.map((term: EduTermItem) => ({
          id: term.id,
          label: `${term.name}${term.isCurrent ? t(`${NS}.currentTermTag`) : ''}`,
        })),
      )
      const current = list.find((term: EduTermItem) => term.isCurrent) ?? list[0]
      setSelectedTermId((prev) => prev || current?.id || '')
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [user, t])

  useEffect(() => {
    void loadTerms()
  }, [loadTerms])

  /* ── 班级 ── */
  const loadClasses = useCallback(
    async (termId: string) => {
      try {
        const res = await getEduClasses(termId)
        if (!res.success || !res.data) {
          setClasses([])
          return
        }
        const list = res.data.list ?? []
        setClasses(
          list.map((cls: EduClassItem) => ({
            id: cls.id,
            label: `${cls.name}${cls.grade ? ` (${cls.grade})` : ''}`,
          })),
        )
        setSelectedClassId((prev) => (list.some((c: EduClassItem) => c.id === prev) ? prev : list[0]?.id ?? ''))
      } catch {
        setClasses([])
      }
    },
    [],
  )

  useEffect(() => {
    if (!selectedTermId) return
    void loadClasses(selectedTermId)
  }, [selectedTermId, loadClasses])

  /* ── 统计 + 提交列表 ── */
  const loadStats = useCallback(
    async (classId: string) => {
      setStatsLoading(true)
      try {
        const res = await getHomeworkSubmissionStats(classId)
        const data: HomeworkStatsResult | undefined = res.data
        if (!res.success || !data) {
          setStats(null)
          return
        }
        setStats({
          totalText: String(data.totalCount ?? 0),
          gradedText: String(data.gradedCount ?? 0),
          avgText: t(`${NS}.scoreWithUnit`, { score: data.avgScore ?? 0 }),
          rateText: `${data.completionRate ?? 0}%`,
        })
      } catch {
        setStats(null)
      } finally {
        setStatsLoading(false)
      }
    },
    [t],
  )

  const loadSubmissions = useCallback(
    async (classId: string) => {
      setLoadingSubmissions(true)
      try {
        const res = await getHomeworkSubmissions({ classId, pageSize: 100 })
        if (!res.success || !res.data) {
          setRows([])
          return
        }
        setRows((res.data.list ?? []).filter((s: HomeworkSubmissionItem) => !s.deletedAt).map(toView))
      } catch {
        setRows([])
      } finally {
        setLoadingSubmissions(false)
      }
    },
    [toView],
  )

  useEffect(() => {
    if (!selectedClassId) {
      setRows([])
      setStats(null)
      return
    }
    void loadStats(selectedClassId)
    void loadSubmissions(selectedClassId)
  }, [selectedClassId, reloadKey, loadStats, loadSubmissions])

  /* ── 批改 ── */
  const submitGrade = useCallback(
    async (id: string, score: number, comment: string): Promise<boolean> => {
      setGradeSaving(true)
      setGradeError(null)
      try {
        const res = await gradeHomeworkSubmission(id, { score, comment: comment || undefined })
        if (!res.success) {
          setGradeError(t('common.loadFailed'))
          return false
        }
        setReloadKey((k) => k + 1)
        return true
      } catch {
        setGradeError(t('common.loadFailed'))
        return false
      } finally {
        setGradeSaving(false)
      }
    },
    [t],
  )

  const visibleRows = useMemo(
    () => (statusFilter === 'all' ? rows : rows.filter((row) => row.status === statusFilter)),
    [rows, statusFilter],
  )

  return (
    <SharedEduHomeworkScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      onRetry={() => void loadTerms()}
      terms={terms}
      selectedTermId={selectedTermId}
      onSelectTerm={(id: string) => {
        setSelectedTermId(id)
        setSelectedClassId('')
        setClasses([])
      }}
      classes={classes}
      selectedClassId={selectedClassId}
      onSelectClass={setSelectedClassId}
      stats={stats}
      statsLoading={statsLoading}
      submissions={visibleRows}
      statusFilter={statusFilter}
      onStatusFilter={setStatusFilter}
      loadingSubmissions={loadingSubmissions}
      gradeSaving={gradeSaving}
      gradeError={gradeError}
      onSubmitGrade={submitGrade}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
