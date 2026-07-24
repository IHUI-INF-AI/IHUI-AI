'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, FileCheck } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

import type { PaperDetail } from './types'

interface Props {
  paper: PaperDetail
  isPending: boolean
  isError: boolean
  error: unknown
  onStart: () => void
}

export function ExamIntro({ paper, isPending, isError, error, onStart }: Props) {
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileCheck className="h-5 w-5 text-primary" />
            {paper.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">{t('questionCountLabel')}</div>
              <div className="font-semibold">{paper.questions.length}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">
                {t('totalScore', { score: paper.totalScore })}
              </div>
              <div className="font-semibold">{paper.totalScore}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-muted-foreground">
                {t('duration', { minutes: paper.duration })}
              </div>
              <div className="font-semibold">{paper.duration}m</div>
            </div>
          </div>
          <Button className="w-full" size="lg" disabled={isPending} onClick={onStart}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('startExam')}
          </Button>
          {isError && <p className="text-xs text-destructive">{(error as Error)?.message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
