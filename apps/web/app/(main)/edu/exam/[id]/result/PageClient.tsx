'use client'

import * as React from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, Check, X, Loader2, Award, RotateCcw } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface QuestionResult {
  questionId: string
  title: string
  correct: boolean
  score: number
  myAnswer?: string
  correctAnswer?: string
}
interface ExamResult {
  score: number
  totalScore: number
  passed: boolean
  duration: number
  submittedAt: string
  results: QuestionResult[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function EduExamResultPage() {
  const t = useTranslations('eduExamResultPage')
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const recordId = searchParams.get('recordId')
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exam', id, 'result', recordId],
    queryFn: () =>
      api<{ result: ExamResult }>(
        `/api/edu/exam/${id}/result${recordId && recordId.length > 0 ? `?recordId=${recordId}` : ''}`,
      ).then((d) => d.result),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push('/edu/exam')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </button>
        <Alert variant="danger" description={(error as Error)?.message ?? t('notExists')} />
      </div>
    )
  }

  const result = data
  const correctCount = result.results.filter((r) => r.correct).length

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/edu/exam"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <Card>
        <CardHeader className="text-center">
          <div
            className={cn(
              'mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl',
              result.passed
                ? 'bg-emerald-500/10 text-emerald-600'
                : 'bg-destructive/10 text-destructive',
            )}
          >
            {result.passed ? <Check className="h-7 w-7" /> : <X className="h-7 w-7" />}
          </div>
          <CardTitle className="text-2xl">
            {t('totalScore', { score: result.score, total: result.totalScore })}
          </CardTitle>
          <p
            className={cn(
              'text-sm font-medium',
              result.passed ? 'text-emerald-600' : 'text-destructive',
            )}
          >
            {result.passed ? t('passed') : t('failed')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-muted-foreground">{t('correct')}</p>
              <p className="text-lg font-bold text-emerald-600">{correctCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('wrong')}</p>
              <p className="text-lg font-bold text-destructive">
                {result.results.length - correctCount}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('duration')}</p>
              <p className="text-lg font-bold">{t('minutes', { n: result.duration })}</p>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {t('submittedAt', { time: fmt(result.submittedAt) })}
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Award className="h-5 w-5 text-primary" />
          {t('detail')}
        </h2>
        <div className="space-y-2">
          {result.results.map((r, i) => (
            <div key={r.questionId} className="rounded-md border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2">
                  {r.correct ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <X className="h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <span className="text-muted-foreground">
                    {i + 1}. {r.title}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t('score', { n: r.score })}
                </span>
              </div>
              {!r.correct && (
                <div className="mt-2 space-y-1 pl-6 text-xs">
                  {r.myAnswer && (
                    <p className="text-destructive">{t('yourAnswer', { answer: r.myAnswer })}</p>
                  )}
                  {r.correctAnswer && (
                    <p className="text-emerald-600">
                      {t('correctAnswer', { answer: r.correctAnswer })}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-center gap-3">
        <Button asChild variant="outline">
          <Link href="/edu/exam">
            <RotateCcw className="h-4 w-4" />
            {t('backList')}
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/edu/exam/${id}`}>{t('retry')}</Link>
        </Button>
      </div>
    </div>
  )
}
