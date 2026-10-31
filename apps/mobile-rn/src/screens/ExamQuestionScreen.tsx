// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  ExamQuestionScreen as SharedExamQuestionScreen,
  type ExamQuestionItem,
  type ExamQuestionPaper,
  type ExamQuestionScreenProps,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'ExamQuestion'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * GET /exam/papers/:id/questions 的题目形状(apps/api/src/routes/exam.ts:547-585)。
 * 后端题型五档 single/multiple/judge/fill/essay;options 为 [{key,value}] 或 null;
 * answer 已剥离,带 score。
 */
type ApiQuestionType = 'single' | 'multiple' | 'judge' | 'fill' | 'essay'
interface ApiExamQuestion {
  id: string
  type: ApiQuestionType
  title: string
  options: { key: string; value: string }[] | null
  score: number
}
interface ApiQuestionsPayload {
  exam: { id: string; title: string; duration: number }
  questions: ApiExamQuestion[]
}

/** 后端题型 → 共享屏题型(fill_blank→fill、subjective→subjective、judgment→judgment) */
const QUESTION_TYPE_MAP: Record<ApiQuestionType, ExamQuestionItem['type']> = {
  single: 'single',
  multiple: 'multi',
  judge: 'judgment',
  fill: 'fill',
  essay: 'subjective',
}

/** 作答模型(与共享屏 props 同源) */
type AnswersMap = ExamQuestionScreenProps['answers']

/**
 * 提交体序列化:POST /exam/papers/:examId/submit-answers 的入参 schema 是
 * `answers: [{ questionId: uuid, answer?: unknown }]`(apps/api/src/routes/exam.ts:875-889),
 * 判分按题型读 answer(exam.ts:907-940):single/judgment 直接比、multi 排序比、
 * fill_blank 逐空 trim 比、subjective 不自动判分。故:
 * - single/multi 提交选项 key(题库 answer 存 "A"/["A","B"],不是下标);
 * - judgment 提交布尔;fill/subjective 提交文本;未作答的题不进数组。
 */
function serializeAnswers(
  questions: ApiExamQuestion[],
  answers: AnswersMap,
): { questionId: string; answer: string | string[] | boolean }[] {
  const payload: { questionId: string; answer: string | string[] | boolean }[] = []
  for (const q of questions) {
    const value = answers[q.id]
    if (value === undefined) continue
    const keys = (q.options ?? []).map((o) => o.key)
    if (q.type === 'single') {
      if (typeof value !== 'number') continue
      payload.push({ questionId: q.id, answer: keys[value] ?? String(value) })
    } else if (q.type === 'multiple') {
      if (!Array.isArray(value)) continue
      const picked = value.filter((v): v is number => typeof v === 'number')
      if (picked.length === 0) continue
      payload.push({ questionId: q.id, answer: picked.map((i) => keys[i] ?? String(i)) })
    } else if (q.type === 'judge') {
      if (typeof value !== 'boolean') continue
      payload.push({ questionId: q.id, answer: value })
    } else {
      if (typeof value !== 'string' || value.trim() === '') continue
      payload.push({ questionId: q.id, answer: value })
    }
  }
  return payload
}

export function ExamQuestionScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { examId } = route.params
  const [exam, setExam] = useState<ExamQuestionPaper | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<AnswersMap>({})
  const [submitting, setSubmitting] = useState(false)
  // 剩余秒数;undefined = 卷面无时长(不渲染倒计时,也不自动交卷)
  const [leftSec, setLeftSec] = useState<number | undefined>(undefined)
  // 截止时刻(毫秒)。倒计时按墙钟推导,切后台再回来不会白送时间
  const deadlineRef = useRef<number | null>(null)
  const questionsRef = useRef<ApiExamQuestion[]>([])
  const answersRef = useRef<AnswersMap>(answers)
  answersRef.current = answers
  const submittingRef = useRef(false)
  const autoSubmittedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<ApiQuestionsPayload>(
        `/api/exam/papers/${encodeURIComponent(examId)}/questions`,
      )
      if (cancelled) return
      if (res.success) {
        const payload = res.data
        const questions = payload.questions ?? []
        questionsRef.current = questions
        setExam({
          id: payload.exam.id,
          title: payload.exam.title,
          duration: payload.exam.duration,
          questions: questions.map((q) => ({
            id: q.id,
            type: QUESTION_TYPE_MAP[q.type] ?? 'single',
            content: q.title,
            options: (q.options ?? []).map((o) => o.value),
            score: q.score,
          })),
        })
        // 倒计时来源 = 接口回的试卷时长(duration 分钟);<=0 表示不限时 ⇒ 不显示
        const budget = payload.exam.duration > 0 ? payload.exam.duration * 60 : undefined
        deadlineRef.current = budget === undefined ? null : Date.now() + budget * 1000
        setLeftSec(budget)
      } else {
        setError(apiFailureToText(res, t('examQuestion.loadFailed')))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [examId, t])

  const toggleOption = (qId: string, optIdx: number, multi: boolean) => {
    setAnswers((prev) => {
      const cur = prev[qId]
      const picked = Array.isArray(cur) ? cur.filter((v): v is number => typeof v === 'number') : []
      if (multi)
        return {
          ...prev,
          [qId]: picked.includes(optIdx) ? picked.filter((i) => i !== optIdx) : [...picked, optIdx],
        }
      return { ...prev, [qId]: [optIdx] }
    })
  }

  const answer = useCallback((qId: string, value: string | boolean) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }))
  }, [])

  const onSubmit = useCallback(async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setError('')
    const payload = serializeAnswers(questionsRef.current, answersRef.current)
    const res = await fetchApi<{ examId: string }>(
      `/api/exam/papers/${encodeURIComponent(examId)}/submit-answers`,
      { method: 'POST', body: JSON.stringify({ answers: payload }) },
    )
    submittingRef.current = false
    setSubmitting(false)
    if (!res.success) {
      setError(apiFailureToText(res, t('examQuestion.submitFailed')))
      return
    }
    navigation.goBack()
  }, [examId, navigation, t])

  // 倒计时:按截止时刻逐秒重算;到 0 自动交卷(对齐 web PageClient 的自动交卷),
  // 只触发一次;自动交卷失败后仍可手动交卷
  useEffect(() => {
    if (leftSec === undefined) return
    if (leftSec <= 0) {
      if (!autoSubmittedRef.current) {
        autoSubmittedRef.current = true
        void onSubmit()
      }
      return
    }
    const deadline = deadlineRef.current
    if (deadline === null) return
    const timer = setTimeout(() => {
      setLeftSec(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    }, 1000)
    return () => clearTimeout(timer)
  }, [leftSec, onSubmit])

  return (
    <SharedExamQuestionScreen
      t={t}
      exam={exam}
      loading={loading}
      error={error}
      current={current}
      answers={answers}
      onToggleOption={toggleOption}
      onAnswer={answer}
      leftSec={leftSec}
      submitting={submitting}
      onPrev={() => setCurrent((c) => Math.max(0, c - 1))}
      onNext={() => setCurrent((c) => c + 1)}
      onSubmit={() => void onSubmit()}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
