'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Check, X } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

import type { PaperDetail, SubmitResult } from './types'

interface Props {
  paper: PaperDetail
  result: SubmitResult
}

export function ExamResult({ paper, result }: Props) {
  const t = useTranslations('exam')

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/exam"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>
      <Card>
        <CardHeader className="text-center">
          <div
            className={cn(
              'mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full',
              result.passed
                ? 'bg-emerald-500/10 text-emerald-600'
                : 'bg-destructive/10 text-destructive',
            )}
          >
            {result.passed ? <Check className="h-7 w-7" /> : <X className="h-7 w-7" />}
          </div>
          <CardTitle className="text-2xl">
            {t('score', { score: result.score, total: paper.totalScore })}
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
        <CardContent className="space-y-2">
          {result.results.map((r, i) => {
            const q = paper.questions.find((x) => x.id === r.questionId)
            return (
              <div
                key={r.questionId}
                className="flex items-start justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  {r.correct ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-muted-foreground">
                    {i + 1}. {q?.title}
                  </span>
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
