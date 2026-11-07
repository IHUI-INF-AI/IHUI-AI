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
import type { TFunction } from '@ihui/types'
import { ExamResultReviewList, ExamResultStats } from '@ihui/rn-app/pilot'
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

/**
 * 共享段(packages/app `exam-result-sections`)的 key → 本端 `exam.result.*` 词表。
 * 统计网格 / 全量解析的**渲染**已在共享段里,这里只做词表适配,不重复任何 UI。
 */
function buildSharedTranslator(
  tExam: (key: string, values?: Record<string, string | number>) => string,
): TFunction {
  return (key, options) => {
    switch (key) {
      case 'examResult.statCorrect':
        return tExam('result.correct')
      case 'examResult.statWrong':
        return tExam('result.wrong')
      case 'examResult.statUnanswered':
        return tExam('result.unanswered')
      case 'examResult.duration':
        return tExam('result.duration')
      case 'examResult.durationUnit':
        return tExam('result.minutes', { n: Number(options?.n ?? 0) })
      case 'examResult.countUnit':
        return String(options?.n ?? 0)
      case 'examResult.reviewTitle':
        return tExam('result.detailsTitle')
      case 'examResult.noReview':
        return tExam('result.detailsEmpty')
      case 'examResult.questionIdx':
        return String(options?.n ?? '')
      case 'examResult.reviewCorrect':
        return tExam('result.reviewCorrect')
      case 'examResult.reviewWrong':
        return tExam('result.reviewWrong')
      case 'examResult.yourAnswer':
        return tExam('result.yourAnswer')
      case 'examResult.unansweredAnswer':
        return tExam('result.unansweredAnswer')
      case 'examResult.correctAnswer':
        return tExam('result.correctAnswer')
      case 'examResult.analysis':
        return tExam('result.analysis')
      case 'examResult.reviewScore':
        return tExam('result.points', { n: Number(options?.n ?? 0) })
      default:
        return key
    }
  }
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
  const sharedT = buildSharedTranslator(
    t as unknown as (key: string, values?: Record<string, string | number>) => string,
  )
  const reviews = (result?.details ?? []).map((d: ResultDetail) => ({
    id: d.questionId,
    title: d.title,
    yourAnswer: d.userAnswer,
    correctAnswer: d.correctAnswer,
    isCorrect: d.isCorrect,
    score: d.score,
    analysis: d.analysis,
  }))

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
        {/* 错/未答/正确/用时 四格 —— 渲染归共享段(exam-result-sections),词表由 buildSharedTranslator 适配 */}
        <CardContent className="pt-0">
          <ExamResultStats
            item={{
              id: result.examId,
              score: result.score,
              totalScore: result.totalScore,
              passed: result.isPassed,
              correctCount: result.correctCount,
              wrongCount: result.wrongCount,
              unansweredCount: result.unansweredCount,
              totalCount: result.correctCount + result.wrongCount + result.unansweredCount,
              duration: result.duration,
            }}
            t={sharedT}
          />
        </CardContent>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 text-label text-muted-foreground">
            <Award className="h-3.5 w-3.5" />
            {t('result.submittedAt', { time: fmt(result.submittedAt) })}
          </div>
        </CardContent>
      </Card>

      {/* 全量解析(题干 + 你的答案 + 正确答案 + 解析 + 本题得分) —— 渲染归共享段 */}
      <ExamResultReviewList reviews={reviews} t={sharedT} />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
