import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getExams, type Exam } from '@ihui/api-client'
import { ExamScreen as SharedExamScreen, type ExamItem, type ExamStatus } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { formatDateByTemplate } from '../utils/date-utils'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function getExamStatus(e: ExamItem, now: number): ExamStatus {
  if (e.endTime && new Date(e.endTime).getTime() < now) return 'ended'
  if (e.startTime && new Date(e.startTime).getTime() > now) return 'notStarted'
  return 'inProgress'
}

function toExamItem(e: Exam): ExamItem {
  const fmt = (s: string | null) => (s ? formatDateByTemplate(s, 'YYYY-MM-DD HH:mm') : undefined)
  return {
    id: e.id, title: e.title, duration: e.duration, totalScore: e.totalScore,
    passScore: e.passScore, questionCount: e.questionCount,
    attemptCount: e.attemptCount, maxAttempts: e.maxAttempts,
    description: e.description || undefined,
    startTime: fmt(e.startTime), endTime: fmt(e.endTime),
  }
}

export function ExamScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [exams, setExams] = useState<ExamItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const res = await getExams({ pageSize: 20 })
      if (res.success) setExams((res.data.list ?? []).map(toExamItem))
      else setError(res.error || t('exam.loadFailed'))
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const getStatus = useCallback((exam: ExamItem) => getExamStatus(exam, Date.now()), [])

  const onStart = (exam: ExamItem) => {
    const status = getExamStatus(exam, Date.now())
    if (status === 'ended') return setToast(t('exam.ended'))
    if (status === 'notStarted') return setToast(t('exam.notStarted'))
    if (exam.attemptCount >= exam.maxAttempts && exam.maxAttempts > 0) return setToast(t('exam.noAttemptsLeft'))
    setToast(t('exam.startHint', { title: exam.title }))
  }

  return (
    <SharedExamScreen
      t={t}
      items={exams}
      getStatus={getStatus}
      loading={loading}
      refreshing={refreshing}
      error={error}
      toast={toast}
      onRefresh={() => load(true)}
      onStart={onStart}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
