// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 校园课表页(mobile-rn 端)—— 薄壳,复用通用控制台列表屏 ConsoleTableScreen
 * (覆盖 web edu/edu-management/schedule 的课表实体,复合页首版)。
 * 端点(与 web schedule/page.tsx 同源):
 *  - GET /api/edu-ai-management/term                        ⇒ { list: Term[] }(isCurrent 优先)
 *  - GET /api/edu-ai-management/class?termId=               ⇒ { list: EduClass[] }(取第一个)
 *  - GET /api/edu-ai-management/schedule?termId=&classId=   ⇒ { list: ScheduleEntry[] }
 * 首版承载当前学期首个班级的课表列表;排课编辑/复制上周排后续轮。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import { ConsoleTableScreen, type ConsoleColumn, type ConsoleRowView } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Term {
  id: string
  name: string
  isCurrent: boolean
}

interface EduClass {
  id: string
  name: string
}

interface ScheduleEntry {
  id: string
  courseName: string
  teacher: string | null
  weekday: number
  startTime: string
  endTime: string
  classroom: string | null
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export function EduScheduleScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const [rows, setRows] = useState<ConsoleRowView[]>([])
  const [subtitle, setSubtitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const weekdayLabel = useCallback(
    (n: number) => {
      const key = `eduSchedule.weekday.${WEEKDAY_KEYS[n - 1] ?? ''}`
      const v = t(key)
      return v === key ? String(n) : v
    },
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const terms = await fetchApi<{ list: Term[] }>('/api/edu-ai-management/term')
      if (!terms.success) throw new Error(terms.error || 'load failed')
      const tlist = terms.data?.list ?? []
      const current = tlist.find((x) => x.isCurrent) ?? tlist[0]
      if (!current) return
      const classes = await fetchApi<{ list: EduClass[] }>(
        `/api/edu-ai-management/class?termId=${current.id}`,
      )
      if (!classes.success) throw new Error(classes.error || 'load failed')
      const firstClass = (classes.data?.list ?? [])[0]
      setSubtitle(firstClass ? `${current.name} · ${firstClass.name}` : current.name)
      const res = await fetchApi<{ list: ScheduleEntry[] }>(
        `/api/edu-ai-management/schedule?termId=${current.id}${firstClass ? `&classId=${firstClass.id}` : ''}`,
      )
      if (!res.success) throw new Error(res.error || 'load failed')
      setRows(
        (res.data?.list ?? []).map((s) => ({
          id: s.id,
          cells: {
            weekday: weekdayLabel(s.weekday),
            course: s.courseName,
            teacher: s.teacher ?? '—',
            time: `${s.startTime.slice(0, 5)}-${s.endTime.slice(0, 5)}`,
            classroom: s.classroom ?? '—',
          },
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [weekdayLabel])

  useEffect(() => {
    void load()
  }, [load])

  const columns: ConsoleColumn[] = [
    { key: 'weekday', title: t('eduSchedule.weekdayTitle'), render: 'badge' },
    { key: 'course', title: t('eduSchedule.course'), flex: 2 },
    { key: 'teacher', title: t('eduSchedule.teacher') },
    { key: 'time', title: t('eduSchedule.time') },
    { key: 'classroom', title: t('eduSchedule.classroom') },
  ]

  return (
    <ConsoleTableScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      title={subtitle ? `${t('eduSchedule.title2')} · ${subtitle}` : t('eduSchedule.title2')}
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      onRefresh={() => void load()}
    />
  )
}

export default EduScheduleScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
