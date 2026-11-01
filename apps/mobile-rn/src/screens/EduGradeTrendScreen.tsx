// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  EduGradeTrendScreen as SharedEduGradeTrendScreen,
  type EduGradeTrendEntry,
  type EduGradeWeaknessItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'EduGradeTrend'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * `GET /api/edu-ai-management/exam-score/trend/:id` 的裸行
 * (apps/api/src/routes/edu-ai-management.ts:4955-4963 的 select 列)。
 * numeric 列在 JSON 里可能是串 ⇒ 全部按 unknown 收,统一过 toNumber。
 */
interface TrendRawRow {
  id?: string | number | null
  examName?: string | null
  subject?: string | null
  score?: number | string | null
  totalScore?: number | string | null
  examDate?: string | null
}

/**
 * weakness 裸行 —— **两种字段名都要认**:
 *  - 现网实回(:4994-5000):`subject / avgScore / examCount / totalScore / weak`,
 *    且只回 weak 的科目,没有 `percentage`;
 *  - 工单契约 / web 读法:`percentage` + `isWeak`(web 拿这两个字段渲染,实回恒缺)。
 */
interface WeaknessRawRow {
  subject?: string | null
  avgScore?: number | string | null
  totalScore?: number | string | null
  percentage?: number | string | null
  examCount?: number | string | null
  isWeak?: boolean | null
  weak?: boolean | null
}

/** trend 回包:web/工单读 `{ list }`(实回同形) */
interface TrendPayload {
  list?: TrendRawRow[] | null
}

/** weakness 回包:`{ weaknesses }` 现网实回,`{ weakness }` web 读法,两条都认 */
interface WeaknessPayload {
  weaknesses?: WeaknessRawRow[] | null
  weakness?: WeaknessRawRow[] | null
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toText(value: string | null | undefined): string {
  return typeof value === 'string' ? value : ''
}

function toEntry(row: TrendRawRow): EduGradeTrendEntry {
  const examName = toText(row.examName)
  const subject = toText(row.subject)
  return {
    // 后端 id 是 uuid;缺失时用「考试名+科目」兜底做 key,不编序号(重渲染不乱序)
    id:
      row.id !== null && row.id !== undefined && row.id !== ''
        ? String(row.id)
        : `${examName}-${subject}`,
    examName,
    subject,
    score: toNumber(row.score),
    totalScore: toNumber(row.totalScore),
    examDate: toText(row.examDate),
  }
}

/**
 * 归一成屏侧契约:percentage 缺失按 avgScore/totalScore 现算(0..100),
 * isWeak 缺失回落后端真实字段 `weak`;两位数都拿不到就按 60% 及格线判 ——
 * 与后端 `rate < 0.6` 同口径,不额外发明阈值。
 */
function toWeakness(row: WeaknessRawRow): EduGradeWeaknessItem {
  const totalScore = toNumber(row.totalScore)
  const avgScore = toNumber(row.avgScore)
  const computed = totalScore > 0 ? (avgScore / totalScore) * 100 : 0
  const percentage =
    row.percentage !== null && row.percentage !== undefined ? toNumber(row.percentage) : computed
  const clamped = Math.min(100, Math.max(0, percentage))
  const isWeak =
    typeof row.isWeak === 'boolean'
      ? row.isWeak
      : typeof row.weak === 'boolean'
        ? row.weak
        : clamped < 60
  return {
    subject: toText(row.subject),
    avgScore,
    totalScore,
    percentage: clamped,
    examCount: toNumber(row.examCount),
    isWeak,
  }
}

/**
 * 成绩趋势 / 薄弱环节屏 —— RN 宿主壳,对齐 web `edu/edu-management/grades/trend/[studentId]`。
 *
 * 两条 GET 并行拉:趋势(按 `?subject=` 过滤)与薄弱统计。取数 + 归一 + 导航在此,
 * 渲染全在共享屏 `@ihui/rn-app` 的 EduGradeTrendScreen。
 *
 * 筛选语义同 web:选中某科后按 `?subject=` 重取 trend(后端支持过滤),weakness 不随科目走
 * (后端无该入参)⇒ 切科目时只重拉 trend,弱点卡保持全科视图,与 web 行为一致。
 */
export function EduGradeTrendScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { studentId } = route.params

  const [selectedSubject, setSelectedSubject] = useState('')
  const [entries, setEntries] = useState<EduGradeTrendEntry[]>([])
  const [weaknesses, setWeaknesses] = useState<EduGradeWeaknessItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [trendRes, weaknessRes] = await Promise.all([
        fetchApi<TrendPayload>(
          `/api/edu-ai-management/exam-score/trend/${encodeURIComponent(studentId)}`,
          selectedSubject ? { params: { subject: selectedSubject } } : {},
        ),
        fetchApi<WeaknessPayload>(
          `/api/edu-ai-management/exam-score/weakness/${encodeURIComponent(studentId)}`,
        ),
      ])

      // 趋势是主数据:它失败才把整屏判成错误态;弱点卡单独失败只清空自己
      if (!trendRes.success) {
        setEntries([])
        setWeaknesses([])
        setError(apiFailureToText(trendRes, t('eduGradeTrend.loadFailed')))
        return
      }
      setEntries((trendRes.data?.list ?? []).map(toEntry))

      if (!weaknessRes.success) {
        setWeaknesses([])
        return
      }
      const rawWeakness = weaknessRes.data?.weaknesses ?? weaknessRes.data?.weakness ?? []
      setWeaknesses(rawWeakness.map(toWeakness))
    } catch {
      setEntries([])
      setWeaknesses([])
      setError(t('eduGradeTrend.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [selectedSubject, studentId, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedEduGradeTrendScreen
      t={t}
      studentId={studentId}
      entries={entries}
      weaknesses={weaknesses}
      selectedSubject={selectedSubject}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
      onRetry={() => void load()}
      onSelectSubject={setSelectedSubject}
      colorScheme={resolvedTheme}
    />
  )
}

export default EduGradeTrendScreen
