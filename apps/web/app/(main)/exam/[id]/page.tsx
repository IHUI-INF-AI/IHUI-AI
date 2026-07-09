'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, Clock, Check, X, FileCheck } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

type QType = 'single' | 'multiple' | 'judge' | 'fill' | 'subjective'
interface Option { key: string; text: string }
interface Question {
  id: string
  type: QType
  title: string
  options?: Option[]
  score: number
}
interface PaperDetail {
  id: string
  title: string
  duration: number
  totalScore: number
  passScore: number
  questions: Question[]
}
interface SubmitResult {
  score: number
  passed: boolean
  results: { questionId: string; correct: boolean; score: number }[]
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

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
    mutationFn: () => api<{ record: { id: string } }>(`/api/exam/papers/${id}/start`, { method: 'POST' }),
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

  React.useEffect(() => {
    if (phase !== 'answering' || leftSec <= 0) return
    const tm = setInterval(() => setLeftSec((s) => s - 1), 1000)
    return () => clearInterval(tm)
  }, [phase, leftSec])

  React.useEffect(() => {
    if (phase === 'answering' && leftSec === 0 && recordId && !submitMut.isPending) {
      submitMut.mutate({ answers })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftSec, phase])

  const handleAnswer = (qid: string, val: string | string[]) =>
    setAnswers((a) => ({ ...a, [qid]: val }))

  const toggleMulti = (qid: string, key: string) =>
    setAnswers((a) => {
      const cur = (a[qid] as string[]) ?? []
      return { ...a, [qid]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] }
    })

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

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
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Link href="/exam" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <Card>
          <CardHeader className="text-center">
            <div className={cn('mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full', result.passed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive')}>
              {result.passed ? <Check className="h-7 w-7" /> : <X className="h-7 w-7" />}
            </div>
            <CardTitle className="text-2xl">
              {t('score', { score: result.score, total: paper.totalScore })}
            </CardTitle>
            <p className={cn('text-sm font-medium', result.passed ? 'text-emerald-600' : 'text-destructive')}>
              {result.passed ? t('passed') : t('failed')}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.results.map((r, i) => {
              const q = paper.questions.find((x) => x.id === r.questionId)
              return (
                <div key={r.questionId} className="flex items-start justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    {r.correct ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-destructive" />}
                    <span className="text-muted-foreground">{i + 1}. {q?.title}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{r.score}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === 'intro') {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Link href="/exam" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileCheck className="h-5 w-5 text-primary" />
              {paper.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-md border p-3"><div className="text-muted-foreground">{t('questionCountLabel')}</div><div className="font-semibold">{paper.questions.length}</div></div>
              <div className="rounded-md border p-3"><div className="text-muted-foreground">{t('totalScore', { score: paper.totalScore })}</div><div className="font-semibold">{paper.totalScore}</div></div>
              <div className="rounded-md border p-3"><div className="text-muted-foreground">{t('duration', { minutes: paper.duration })}</div><div className="font-semibold">{paper.duration}m</div></div>
            </div>
            <Button className="w-full" size="lg" disabled={startMut.isPending} onClick={() => startMut.mutate()}>
              {startMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('startExam')}
            </Button>
            {startMut.isError && <p className="text-xs text-destructive">{(startMut.error as Error)?.message}</p>}
          </CardContent>
        </Card>
      </div>
    )
  }

  // answering phase
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-md border bg-background/95 px-4 py-2 backdrop-blur">
        <span className="text-sm font-medium">{paper.title}</span>
        <span className={cn('flex items-center gap-1 text-sm font-semibold', leftSec < 60 ? 'text-destructive' : 'text-muted-foreground')}>
          <Clock className="h-4 w-4" />
          {mmss(Math.max(0, leftSec))}
        </span>
      </div>

      {paper.questions.map((q, i) => (
        <Card key={q.id}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium">
              <span className="text-muted-foreground">{i + 1}.</span> {q.title}
              <span className="ml-2 text-xs font-normal text-muted-foreground">({q.score})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0 text-sm">
            {q.type === 'multiple' ? (
              (q.options ?? []).map((o) => (
                <label key={o.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent">
                  <input type="checkbox" checked={((answers[q.id] as string[]) ?? []).includes(o.key)} onChange={() => toggleMulti(q.id, o.key)} className="h-4 w-4" />
                  <span>{o.key}. {o.text}</span>
                </label>
              ))
            ) : q.type === 'subjective' || q.type === 'fill' ? (
              <textarea
                value={(answers[q.id] as string) ?? ''}
                onChange={(e) => handleAnswer(q.id, e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            ) : (
              (q.options ?? []).map((o) => (
                <label key={o.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent">
                  <input type="radio" name={q.id} checked={answers[q.id] === o.key} onChange={() => handleAnswer(q.id, o.key)} className="h-4 w-4" />
                  <span>{o.key}. {o.text}</span>
                </label>
              ))
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => submitMut.mutate({ answers })} disabled={submitMut.isPending}>
          {submitMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('submit')}
        </Button>
        {leftSec === 0 && <span className="text-xs text-destructive">{t('timeUp')}</span>}
        {submitMut.isError && <span className="text-xs text-destructive">{(submitMut.error as Error)?.message}</span>}
      </div>
    </div>
  )
}
