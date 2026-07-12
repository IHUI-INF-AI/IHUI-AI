'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Clock } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

import { mmss } from './helpers'
import type { PaperDetail } from './types'

interface Props {
  paper: PaperDetail
  answers: Record<string, string | string[]>
  leftSec: number
  isPending: boolean
  isError: boolean
  error: unknown
  onAnswer: (qid: string, val: string | string[]) => void
  onToggleMulti: (qid: string, key: string) => void
  onSubmit: () => void
}

export function ExamAnswering({
  paper,
  answers,
  leftSec,
  isPending,
  isError,
  error,
  onAnswer,
  onToggleMulti,
  onSubmit,
}: Props) {
  const t = useTranslations('exam')

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-md border bg-background/95 px-4 py-2 backdrop-blur">
        <span className="text-sm font-medium">{paper.title}</span>
        <span
          className={cn(
            'flex items-center gap-1 text-sm font-semibold',
            leftSec < 60 ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
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
                <label
                  key={o.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={((answers[q.id] as string[]) ?? []).includes(o.key)}
                    onChange={() => onToggleMulti(q.id, o.key)}
                    className="h-4 w-4"
                  />
                  <span>
                    {o.key}. {o.text}
                  </span>
                </label>
              ))
            ) : q.type === 'subjective' || q.type === 'fill' ? (
              <textarea
                value={(answers[q.id] as string) ?? ''}
                onChange={(e) => onAnswer(q.id, e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            ) : (
              (q.options ?? []).map((o) => (
                <label
                  key={o.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === o.key}
                    onChange={() => onAnswer(q.id, o.key)}
                    className="h-4 w-4"
                  />
                  <span>
                    {o.key}. {o.text}
                  </span>
                </label>
              ))
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onSubmit} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('submit')}
        </Button>
        {leftSec === 0 && <span className="text-xs text-destructive">{t('timeUp')}</span>}
        {isError && <span className="text-xs text-destructive">{(error as Error)?.message}</span>}
      </div>
    </div>
  )
}
