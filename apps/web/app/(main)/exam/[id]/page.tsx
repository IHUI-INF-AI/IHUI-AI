'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { ExamIntro } from './ExamIntro'
import { ExamResult } from './ExamResult'
import { ExamAnswering } from './ExamAnswering'
import { api } from './helpers'
import type { PaperDetail, Question, SubmitResult } from './types'

export default function ExamTakePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('exam')

  const { data, isLoading, error } = useQuery({
    queryKey: ['exam', 'paper', id],
    queryFn: async () => {
      const [paperRes, questionsRes] = await Promise.all([
        api<{ paper: PaperDetail }>(`/api/exam/papers/${id}`),
        api<{ list: Question[] }>(`/api/exam/papers/${id}/questions`),
      ])
      return { ...paperRes.paper, questions: questionsRes.list }
    },
  })

  const [phase, setPhase] = React.useState<'intro' | 'answering' | 'result'>('intro')
  const [recordId, setRecordId] = React.useState<string | null>(null)
  const [answers, setAnswers] = React.useState<Record<string, string | string[]>>({})
  const [result, setResult] = React.useState<SubmitResult | null>(null)
  const [leftSec, setLeftSec] = React.useState(0)

  const startMut = useMutation({
    mutationFn: () =>
      api<{ record: { id: string } }>(`/api/exam/papers/${id}/start`, { method: 'POST' }),
    onSuccess: (d) => {
      setRecordId(d.record.id)
      setPhase('answering')
      setLeftSec((data?.duration ?? 0) * 60)
    },
  })

  const submitMut = useMutation({
    mutationFn: (payload: { answers: Record<string, string | string[]> }) =>
      api<{ result: SubmitResult }>(`/api/exam/records/${recordId}/submit`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((d) => d.result),
    onSuccess: (r) => {
      setResult(r)
      setPhase('result')
    },
  })

  const submitMutRef = React.useRef(submitMut)
  submitMutRef.current = submitMut
  const answersRef = React.useRef(answers)
  answersRef.current = answers

  React.useEffect(() => {
    if (phase !== 'answering' || leftSec <= 0) return
    const tm = setInterval(() => setLeftSec((s) => s - 1), 1000)
    return () => clearInterval(tm)
  }, [phase, leftSec])

  React.useEffect(() => {
    if (phase === 'answering' && leftSec === 0 && recordId && !submitMutRef.current.isPending) {
      submitMutRef.current.mutate({ answers: answersRef.current })
    }
  }, [leftSec, phase, recordId])

  const handleAnswer = (qid: string, val: string | string[]) =>
    setAnswers((a) => ({ ...a, [qid]: val }))

  const toggleMulti = (qid: string, key: string) =>
    setAnswers((a) => {
      const cur = (a[qid] as string[]) ?? []
      return { ...a, [qid]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] }
    })

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
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
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
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
