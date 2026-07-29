import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  ExamQuestionScreen as SharedExamQuestionScreen,
  type ExamQuestionPaper,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'ExamQuestion'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ExamQuestionScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { examId } = route.params
  const [exam, setExam] = useState<ExamQuestionPaper | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number[]>>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<ExamQuestionPaper>(
        `/api/exam/papers/${encodeURIComponent(examId)}`,
      )
      if (cancelled) return
      if (res.success) setExam(res.data)
      else setError(res.error || t('examQuestion.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [examId, t])

  const toggleOption = (qId: string, optIdx: number, multi: boolean) => {
    setAnswers((prev) => {
      const cur = prev[qId] ?? []
      if (multi)
        return {
          ...prev,
          [qId]: cur.includes(optIdx) ? cur.filter((i) => i !== optIdx) : [...cur, optIdx],
        }
      return { ...prev, [qId]: [optIdx] }
    })
  }

  const onSubmit = async () => {
    const res = await fetchApi<{ id: string }>(
      `/api/exam/papers/${encodeURIComponent(examId)}/submit-answers`,
      { method: 'POST', body: JSON.stringify({ answers }) },
    )
    if (res.success && res.data) navigation.replace('ExamResult', { id: res.data.id })
    else if (!res.success) setError(res.error || t('examQuestion.submitFailed'))
  }

  return (
    <SharedExamQuestionScreen
      t={t}
      exam={exam}
      loading={loading}
      error={error}
      current={current}
      answers={answers}
      onToggleOption={toggleOption}
      onPrev={() => setCurrent((c) => Math.max(0, c - 1))}
      onNext={() => setCurrent((c) => c + 1)}
      onSubmit={onSubmit}
      onBack={() => navigation.goBack()}
    />
  )
}
