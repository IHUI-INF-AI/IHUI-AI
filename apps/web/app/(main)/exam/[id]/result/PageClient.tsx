'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft, Check, X, Loader2, Clock, Award } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

interface ResultDetail {
  questionId: string
  title: string
  userAnswer: string | string[]
  correctAnswer: string | string[]
  isCorrect: boolean
  score: number
  analysis: string | null
}

interface ExamResult {
  examId: string
  score: number
  totalScore: number
  isPassed: boolean
  correctCount: number
  wrongCount: number
  unansweredCount: number
  duration: number
  submittedAt: string
  details: ResultDetail[]
}

interface RecordsData {
  list: ExamResult[]
  total: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const normalizeAnswer = (v: string | string[]): string => {
  if (Array.isArray(v)) return v.length > 0 ? v.join('、') : '-'
  return v && v.trim() ? v : '-'
}

export default function ExamResultPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('exam')
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['exam', 'records', 'by-paper', id],
    queryFn: () => api<RecordsData>(`/api/exam/records?examId=${id}&page=1&pageSize=1`),
    enabled: !!id,
  })

  const result = data?.list?.[0] ?? null

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  if (isLoading)
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Link
          href={`/exam/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      </div>
    )

  if (error || !result)
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Link
          href={`/exam/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('empty')}
        </div>
      </div>
    )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href={`/exam/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <Card>
        <CardHeader className="text-center">
          <div
            className={cn(
              'mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl',
              result.isPassed
                ? 'bg-emerald-500/10 text-emerald-600'
                : 'bg-destructive/10 text-destructive',
            )}
          >
            {result.isPassed ? <Check className="h-7 w-7" /> : <X className="h-7 w-7" />}
          </div>
          <CardTitle className="text-2xl">
            {t('score', { score: result.score, total: result.totalScore })}
          </CardTitle>
          <p
            className={cn(
              'text-sm font-medium',
              result.isPassed ? 'text-emerald-600' : 'text-destructive',
            )}
          >
            {result.isPassed ? t('passed') : t('failed')}
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border bg-muted/30 p-3 text-center">
            <div className="text-xs text-muted-foreground">{t('result.correct')}</div>
            <div className="mt-1 text-lg font-semibold text-emerald-600">{result.correctCount}</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-center">
            <div className="text-xs text-muted-foreground">{t('result.wrong')}</div>
            <div className="mt-1 text-lg font-semibold text-destructive">{result.wrongCount}</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-center">
            <div className="text-xs text-muted-foreground">{t('result.unanswered')}</div>
            <div className="mt-1 text-lg font-semibold">{result.unansweredCount}</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-center">
            <div className="text-xs text-muted-foreground">{t('result.duration')}</div>
            <div className="mt-1 flex items-center justify-center gap-1 text-lg font-semibold">
              <Clock className="h-3.5 w-3.5" />
              {t('result.minutes', { n: result.duration })}
            </div>
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Award className="h-3.5 w-3.5" />
            {t('result.submittedAt', { time: fmt(result.submittedAt) })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t('result.detailsTitle')}</h2>
        {result.details.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            {t('result.detailsEmpty')}
          </div>
        ) : (
          <div className="space-y-2">
            {result.details.map((d, i) => (
              <Card key={d.questionId} className="transition-colors hover:bg-accent/40">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      {d.isCorrect ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="break-words text-sm font-medium">
                          {i + 1}. {d.title}
                        </p>
                        <div className="grid gap-1 text-xs">
                          <div className="flex items-start gap-1">
                            <span className="shrink-0 text-muted-foreground">{t('result.yourAnswer')}</span>
                            <span
                              className={cn(
                                'break-words',
                                d.isCorrect ? 'text-emerald-600' : 'text-destructive',
                              )}
                            >
                              {normalizeAnswer(d.userAnswer)}
                            </span>
                          </div>
                          {!d.isCorrect && (
                            <div className="flex items-start gap-1">
                              <span className="shrink-0 text-muted-foreground">{t('result.correctAnswer')}</span>
                              <span className="break-words text-emerald-600">
                                {normalizeAnswer(d.correctAnswer)}
                              </span>
                            </div>
                          )}
                          {d.analysis && (
                            <div className="flex items-start gap-1">
                              <span className="shrink-0 text-muted-foreground">{t('result.analysis')}</span>
                              <span className="break-words text-muted-foreground">
                                {d.analysis}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t('result.points', { n: d.score })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
