// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft, Check, X, Loader2, Award } from 'lucide-react'

import { getMyRecords } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { ExamResultStats, ReviewList } from '@ihui/rn-app/pilot'
import type { ExamResultStatItem, ExamReviewItem } from '@ihui/rn-app/pilot'
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
    queryFn: async (): Promise<RecordsData> => {
      const r = await getMyRecords({ examId: id, page: 1, pageSize: 1 })
      if (!r.success) throw new Error(r.error)
      return r.data as unknown as RecordsData
    },
    enabled: !!id,
  })

  const result = data?.list?.[0] ?? null

  // 成绩四格与答题详情改由共享段承载(packages/app/src/features/exam-result),
  // web 只做字段映射与文案注入;两端 i18n 键族不同,不在此合并。若无记录则不构造。
  const stats: ExamResultStatItem[] = result
    ? [
        {
          key: 'correct',
          label: t('result.correct'),
          value: String(result.correctCount),
          tone: 'correct',
        },
        { key: 'wrong', label: t('result.wrong'), value: String(result.wrongCount), tone: 'wrong' },
        {
          key: 'unanswered',
          label: t('result.unanswered'),
          value: String(result.unansweredCount),
          tone: 'muted',
        },
        {
          key: 'duration',
          label: t('result.duration'),
          value: t('result.minutes', { n: result.duration }),
          tone: 'neutral',
        },
      ]
    : []

  const reviewItems: ExamReviewItem[] = result
    ? result.details.map((d) => ({
        id: d.questionId,
        title: d.title,
        isCorrect: d.isCorrect,
        score: d.score,
        myAnswer: normalizeAnswer(d.userAnswer),
        // web 权益:答对不展示正确答案(原 inline 实现的 !d.isCorrect 分支)
        correctAnswer: d.isCorrect ? undefined : normalizeAnswer(d.correctAnswer),
        analysis: d.analysis ?? undefined,
      }))
    : []

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
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href={`/exam/${id}`}
          className="inline-flex items-center gap-1.5 text-body text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      </div>
    )

  if (error || !result)
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href={`/exam/${id}`}
          className="inline-flex items-center gap-1.5 text-body text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-body text-destructive">
          {(error as Error)?.message ?? t('empty')}
        </div>
      </div>
    )

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-3xl space-y-4">
      <Link
        href={`/exam/${id}`}
        className="inline-flex items-center gap-1.5 text-body text-muted-foreground transition-colors hover:text-foreground"
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
          <CardTitle className="text-display">
            {t('score', { score: result.score, total: result.totalScore })}
          </CardTitle>
          <p
            className={cn(
              'text-body font-medium',
              result.isPassed ? 'text-emerald-600' : 'text-destructive',
            )}
          >
            {result.isPassed ? t('passed') : t('failed')}
          </p>
        </CardHeader>
        <CardContent>
          <ExamResultStats items={stats} colorScheme="light" />
        </CardContent>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 text-label text-muted-foreground">
            <Award className="h-3.5 w-3.5" />
            {t('result.submittedAt', { time: fmt(result.submittedAt) })}
          </div>
        </CardContent>
      </Card>

      <ReviewList
        items={reviewItems}
        title={t('result.detailsTitle')}
        labels={{
          correct: t('result.correct'),
          wrong: t('result.wrong'),
          yourAnswer: t('result.yourAnswer'),
          correctAnswer: t('result.correctAnswer'),
          analysis: t('result.analysis'),
          score: (n) => t('result.points', { n }),
          questionIndex: (n) => `${n}.`,
        }}
        emptyText={t('result.detailsEmpty')}
        colorScheme="light"
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
