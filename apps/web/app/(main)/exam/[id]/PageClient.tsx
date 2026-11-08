// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { ExamIntro } from './ExamIntro'
import { ExamResult } from './ExamResult'
import { ExamAnswering } from './ExamAnswering'
import { getExamById, getExamPaper, startExam, submitExamRecord } from '@ihui/api-client'
import { useDeadlineCountdown } from '@/hooks/use-deadline-countdown'
import type { PaperDetail, Question, SubmitResult } from './types'

export default function ExamTakePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('exam')

  const { data, isLoading, error } = useQuery({
    queryKey: ['exam', 'paper', id],
    queryFn: async () => {
      const [paperRes, questionsRes] = await Promise.all([
        getExamPaper<{ paper: PaperDetail }>(id),
        getExamById(id),
      ])
      if (!paperRes.success) throw new Error(paperRes.error)
      if (!questionsRes.success) throw new Error(questionsRes.error)
      return {
        ...paperRes.data.paper,
        questions: questionsRes.data.questions as unknown as Question[],
      }
    },
  })

  const [phase, setPhase] = React.useState<'intro' | 'answering' | 'result'>('intro')
  const [recordId, setRecordId] = React.useState<string | null>(null)
  const [answers, setAnswers] = React.useState<Record<string, string | string[]>>({})
  const [result, setResult] = React.useState<SubmitResult | null>(null)
  // W-01:以截止时间戳建模,剩余秒数由墙钟派生(见 useDeadlineCountdown)
  const [deadline, setDeadline] = React.useState<number | null>(null)

  const startMut = useMutation({
    mutationFn: async () => {
      const r = await startExam<{ record: { id: string } }>(id)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d: { record: { id: string } }) => {
      setRecordId(d.record.id)
      autoSubmitRef.current = false
      setPhase('answering')
      const duration = data?.duration ?? 0
      // 无限制时长时 deadline=null,不启动倒计时
      setDeadline(duration > 0 ? Date.now() + duration * 60_000 : null)
    },
  })

  const submitMut = useMutation({
    mutationFn: async (payload: { answers: Record<string, string | string[]> }) => {
      const r = await submitExamRecord<{ result: SubmitResult }>(recordId ?? '', {
        answers: Object.entries(payload.answers).map(([questionId, answer]) => ({
          questionId,
          answer,
        })),
      })
      if (!r.success) throw new Error(r.error)
      return r.data.result
    },
    onSuccess: (r: SubmitResult) => {
      setResult(r)
      setPhase('result')
    },
  })

  const submitMutRef = React.useRef(submitMut)
  submitMutRef.current = submitMut
  const answersRef = React.useRef(answers)
  answersRef.current = answers
  // 自动交卷一次性锁:倒计时归零的那次渲染只提交一次,避免重复提交
  const autoSubmitRef = React.useRef(false)

  const leftSec = useDeadlineCountdown(deadline)

  React.useEffect(() => {
    if (phase !== 'answering' || deadline === null || leftSec > 0 || !recordId) return
    if (autoSubmitRef.current || submitMutRef.current.isPending) return
    autoSubmitRef.current = true
    submitMutRef.current.mutate({ answers: answersRef.current })
  }, [leftSec, phase, deadline, recordId])

  const handleAnswer = (qid: string, val: string | string[]) =>
    setAnswers((a) => ({ ...a, [qid]: val }))

  const toggleMulti = (qid: string, key: string) =>
    setAnswers((a) => {
      const cur = (a[qid] as string[]) ?? []
      return { ...a, [qid]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] }
    })

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <button
          type="button"
          onClick={() => router.push('/exam')}
          className="inline-flex items-center gap-1 text-body text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-body text-destructive">
          {(error as Error)?.message ?? t('empty')}
        </div>
      </div>
    )
  }

  const paper = data

  if (phase === 'result' && result) {
    return <ExamResult paper={paper} result={result} />
  }

  if (phase === 'intro') {
    return (
      <ExamIntro
        paper={paper}
        isPending={startMut.isPending}
        isError={startMut.isError}
        error={startMut.error}
        onStart={() => startMut.mutate()}
      />
    )
  }

  return (
    <ExamAnswering
      paper={paper}
      answers={answers}
      leftSec={leftSec}
      isPending={submitMut.isPending}
      isError={submitMut.isError}
      error={submitMut.error}
      onAnswer={handleAnswer}
      onToggleMulti={toggleMulti}
      onSubmit={() => submitMut.mutate({ answers })}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
