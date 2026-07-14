'use client'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, Button } from '@ihui/ui'
import { useTranslations } from 'next-intl'
import type { Question } from './types'

interface Props {
  current: Question | undefined
  qIdx: number
  questions: Question[]
  isLoading: boolean
  onPrev: () => void
  onNext: () => void
}

export function ProgrammingQuestion({
  current,
  qIdx,
  questions,
  isLoading,
  onPrev,
  onNext,
}: Props) {
  const t = useTranslations('admin.edu.answer.programming')
  return (
    <Card>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : !current ? (
          <div className="py-10 text-center text-muted-foreground">
            {t('noProgrammingQuestions')}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t('questionInfo', {
                  current: qIdx + 1,
                  total: questions.length,
                  score: Number(current.score),
                })}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={qIdx <= 0} onClick={onPrev}>
                  {t('prevQuestion')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={qIdx >= questions.length - 1}
                  onClick={onNext}
                >
                  {t('nextQuestion')}
                </Button>
              </div>
            </div>
            <div className="rounded-md bg-muted/40 p-3 text-sm">{current.title}</div>
            <pre className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
              {current.options ? JSON.stringify(current.options, null, 2) : t('noExamples')}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
