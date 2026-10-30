// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 校园成绩页(mobile-rn 端)—— 薄壳,复用通用控制台列表屏 ConsoleTableScreen。
 * 端点(与 web edu/edu-management/grades/PageClient 同源):
 *  - GET /api/edu-ai-management/term ⇒ { list: Term[] }(取 isCurrent,缺省第一个)
 *  - GET /api/edu-ai-management/exam-score?termId= ⇒ { list: EduExamScore[] }
 * 首版承载「当前学期成绩列表」;录分/统计/排行/趋势排后续轮。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
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

interface EduExamScore {
  id: string
  studentId: string
  subject: string
  examName: string
  score: number
  totalScore: number
  examDate: string
}

function EduGradesScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const [rows, setRows] = useState<ConsoleRowView[]>([])
  /** 控制台行 id → 学生 uuid(趋势屏参数);见 load 内的写入注释 */
  const studentIdByRowId = useRef(new Map<string, string>())
  const [termName, setTermName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const terms = await fetchApi<{ list: Term[] }>('/api/edu-ai-management/term')
      if (!terms.success) throw new Error(terms.error || 'load failed')
      const list = terms.data?.list ?? []
      const current = list.find((x) => x.isCurrent) ?? list[0]
      if (!current) {
        setRows([])
        setTermName('')
        return
      }
      setTermName(current.name)
      const res = await fetchApi<{ list: EduExamScore[] }>(
        `/api/edu-ai-management/exam-score?termId=${current.id}`,
      )
      if (!res.success) throw new Error(res.error || 'load failed')
      setRows(
        (res.data?.list ?? []).map((s) => {
          // 趋势屏要的是 `edu_exam_score.student_id`(uuid),而控制台行只留展示格 ⇒
          // 在这里留一份 id→studentId 的对应,点击行时按主键回取,不从展示格反推。
          studentIdByRowId.current.set(s.id, s.studentId)
          return {
            id: s.id,
            cells: {
              student: s.studentId,
              subject: s.subject,
              exam: s.examName,
              score: `${String(s.score)}/${String(s.totalScore)}`,
              date: s.examDate?.slice(0, 10) ?? '',
            },
            badgeTone: s.totalScore > 0 && s.score / s.totalScore >= 0.6 ? 'ok' : 'warn',
          }
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const columns: ConsoleColumn[] = [
    { key: 'student', title: t('eduGrades.student'), render: 'mono', flex: 2 },
    { key: 'subject', title: t('eduGrades.subject') },
    { key: 'exam', title: t('eduGrades.exam'), flex: 2 },
    { key: 'score', title: t('eduGrades.score'), render: 'badge' },
    { key: 'date', title: t('eduGrades.date') },
  ]

  return (
    <ConsoleTableScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      title={termName ? `${t('eduGrades.title')} · ${termName}` : t('eduGrades.title')}
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      onRefresh={() => void load()}
      onRowPress={(row) => {
        // 成绩趋势(web /edu/edu-management/grades/trend/[studentId];2026-10-28 起有原生屏)
        const studentId = studentIdByRowId.current.get(row.id)
        if (studentId) navigation.navigate('EduGradeTrend', { studentId })
      }}
    />
  )
}

export default EduGradesScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
