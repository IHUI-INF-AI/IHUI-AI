// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import {
  getExamScoreTrend,
  getExamScoreWeakness,
  type ExamTrendItem,
  type ExamWeaknessItem,
} from '@ihui/api-client'
import {
  EduGradesTrendScreen as SharedEduGradesTrendScreen,
  type GradeSubjectRateView,
  type GradeTrendRowView,
  type GradeWeaknessRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const NS = 'eduGrades'

/** 本屏在 RootNavigator 里期望的路由名与参数(集成方按 manifest navigator 项登记) */
type EduGradesTrendRoute = RouteProp<{ EduGradesTrend: { studentId: string } }, 'EduGradesTrend'>

/** 得分率 0..100(后端 weaknesses 行无 percentage 字段,按 avgScore/totalScore 现算) */
function toRate(score: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((score / total) * 100)))
}

/**
 * RN 端「成绩趋势分析」薄壳 —— 承载 web /edu/edu-management/grades/trend/[studentId]。
 * 渲染全部委托共享屏,本文件只管:
 *  - 取数:GET /exam-score/trend/:studentId?subject=(apps/api/src/routes/edu-ai-management.ts:4948-4977)
 *    与 GET /exam-score/weakness/:studentId(:4980-5012),两条都 requireEduView(权限级,未登录 401 / 无 edu 权限 403);
 *  - 科目筛选:subject 走服务端精确过滤(:4955-4962),选项集由趋势结果去重排序得出(web PageClient.tsx:121-124);
 *  - 键名对齐后端真形:弱项读 data.weaknesses(web 读 data.weakness ⇒ 线上列表恒空),
 *    布尔读 row.weak(web 读 row.isWeak);得分率自 avgScore/totalScore 现算(web 读不存在的 percentage);
 *  - 文案:三处统计句走 web 同 ns 同键同参(avgScoreStat / scoreRateStat / examCountStat);
 *  - 副标题学生号取前 8 位(web PageClient.tsx:172 同式);
 *  - 错误统一 t('common.loadFailed')。
 * 口径差:web 折线图 + 雷达图(recharts)在 RN 落为分数条(见共享屏头注),同数据同分组不引新图表依赖。
 */
export function EduGradesTrendScreen() {
  const navigation = useNavigation()
  const route = useRoute<EduGradesTrendRoute>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const studentId = route.params?.studentId ?? ''
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [trendList, setTrendList] = useState<ExamTrendItem[]>([])
  const [weaknessList, setWeaknessList] = useState<ExamWeaknessItem[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fmtDate = useMemo(
    () => (value: string | null): string => {
      if (!value) return '-'
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return '-'
      return new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' }).format(d)
    },
    [locale],
  )

  const loadTrend = useCallback(
    async (subject: string) => {
      try {
        const res = await getExamScoreTrend(studentId, subject === 'all' ? undefined : subject)
        if (!res.success || !res.data) {
          setError(t('common.loadFailed'))
          return
        }
        setError(null)
        setTrendList(res.data.list ?? [])
      } catch {
        setError(t('common.loadFailed'))
      }
    },
    [studentId, t],
  )

  const loadWeakness = useCallback(async () => {
    try {
      const res = await getExamScoreWeakness(studentId)
      if (!res.success || !res.data) {
        setError(t('common.loadFailed'))
        return
      }
      setWeaknessList(res.data.weaknesses ?? [])
    } catch {
      setError(t('common.loadFailed'))
    }
  }, [studentId, t])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!user || !studentId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      // 两条端点并行;selectedSubject 变化时一并重拉(weakness 与 subject 无关,
      // 但省掉「一半新一半旧」的中间态,取舍优先一致性)
      await Promise.all([loadTrend(selectedSubject), loadWeakness()])
      if (!cancelled) setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user, studentId, selectedSubject, loadTrend, loadWeakness])

  const subjects = useMemo(() => {
    const set = new Set(trendList.map((entry) => entry.subject))
    return Array.from(set).sort()
  }, [trendList])

  const trend: GradeTrendRowView[] = useMemo(() => {
    const map = new Map<string, GradeTrendRowView>()
    for (const entry of trendList) {
      const group = map.get(entry.subject) ?? { subject: entry.subject, points: [] }
      group.points.push({
        id: entry.id,
        examText: entry.examName,
        dateText: fmtDate(entry.examDate),
        scoreText: String(entry.score),
        rate: toRate(entry.score, entry.totalScore),
      })
      map.set(entry.subject, group)
    }
    return Array.from(map.values())
  }, [trendList, fmtDate])

  const subjectRates: GradeSubjectRateView[] = useMemo(
    () =>
      weaknessList.map((row) => {
        const rate = toRate(row.avgScore, row.totalScore)
        return {
          subject: row.subject,
          rate,
          rateText: t(`${NS}.scoreRateStat`, { percentage: rate }),
        }
      }),
    [weaknessList, t],
  )

  const weaknesses: GradeWeaknessRowView[] = useMemo(
    () =>
      weaknessList.map((row) => {
        const rate = toRate(row.avgScore, row.totalScore)
        return {
          subject: row.subject,
          isWeak: row.weak ?? row.isWeak ?? false,
          avgText: t(`${NS}.avgScoreStat`, { score: row.avgScore }),
          rateText: t(`${NS}.scoreRateStat`, { percentage: rate }),
          countText: t(`${NS}.examCountStat`, { count: row.examCount }),
        }
      }),
    [weaknessList, t],
  )

  return (
    <SharedEduGradesTrendScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      onRetry={() => {
        setLoading(true)
        setError(null)
        void Promise.all([loadTrend(selectedSubject), loadWeakness()]).finally(() =>
          setLoading(false),
        )
      }}
      studentShortId={studentId.slice(0, 8)}
      subjects={subjects}
      selectedSubject={selectedSubject}
      onSelectSubject={setSelectedSubject}
      trend={trend}
      subjectRates={subjectRates}
      weaknesses={weaknesses}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
