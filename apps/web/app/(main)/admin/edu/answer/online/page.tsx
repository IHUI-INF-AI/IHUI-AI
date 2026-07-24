'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Loader2, ChevronLeft, Clock, Send } from 'lucide-react'
import { eduApi, buildQs } from '@/lib/edu'
import { cn } from '@/lib/utils'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { AnswerInput } from './AnswerInput'
import { PaperSelectCard } from './PaperSelectCard'
import { TYPE_LABEL } from './helpers'
import type { Paper, Question } from './types'

function AnswerOnlineContent() {
  const t = useTranslations('admin.edu.answer.online')
  const router = useRouter()
  const [paperId, setPaperId] = React.useState('')
  const [recordId, setRecordId] = React.useState<string | null>(null)
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({})
  const [remaining, setRemaining] = React.useState<number>(0)

  const { data: papersData } = useQuery({
    queryKey: ['edu', 'answer', 'papers'],
    queryFn: () =>
      eduApi<{ list: Paper[] }>(`/api/exam/papers${buildQs({ page: 1, pageSize: 100 })}`),
  })
  const papers = (papersData?.list ?? []).filter((p) => p.isPublished)

  const { data: paper } = useQuery({
    queryKey: ['edu', 'answer', 'paper', paperId],
    queryFn: () => eduApi<{ paper: Paper }>(`/api/exam/papers/${paperId}`).then((d) => d.paper),
    enabled: !!paperId,
  })

  const { data: questionsData, isLoading } = useQuery({
    queryKey: ['edu', 'answer', 'questions', paperId],
    queryFn: () =>
      eduApi<{ list: Question[] }>(`/api/exam/papers/${paperId}/questions`).then(
        (d) => d.list ?? [],
      ),
    enabled: !!paperId,
  })
  const questions = questionsData ?? []

  const startMut = useMutation({
    mutationFn: () =>
      eduApi<{ record: { id: string } }>(`/api/exam/papers/${paperId}/start`, { method: 'POST' }),
    onSuccess: (d) => {
      setRecordId(d.record.id)
      if (paper) setRemaining(paper.duration * 60)
      toast.success(t('started'))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submitMut = useMutation({
    mutationFn: () => {
      const arr = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }))
      return eduApi(`/api/exam/records/${recordId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: arr }),
      })
    },
    onSuccess: (d: unknown) => {
      toast.success(t('submitSuccess'))
      setRecordId(null)
      setAnswers({})
      setRemaining(0)
      router.push('/admin/edu/answer/card')
      void d
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submitMutRef = React.useRef(submitMut)
  submitMutRef.current = submitMut

  React.useEffect(() => {
    if (!recordId || remaining <= 0) return
    const tc = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(tc)
  }, [recordId, remaining])

  React.useEffect(() => {
    if (recordId && remaining === 0 && questions.length > 0) {
      toast.warning(t('timeUpAutoSubmit'))
      submitMutRef.current.mutate()
    }
  }, [remaining, recordId, questions.length, t])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const answered = Object.keys(answers).length

  function setAns(qid: string, v: unknown) {
    setAnswers({ ...answers, [qid]: v })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu">
            <ChevronLeft className="h-4 w-4" />
            {t('back')}
          </Link>
        </Button>
      </div>

      {!recordId ? (
        <PaperSelectCard
          papers={papers}
          paperId={paperId}
          setPaperId={setPaperId}
          paper={paper}
          questions={questions}
          startPending={startMut.isPending}
          onStart={() => startMut.mutate()}
        />
      ) : (
        <>
          <div className="sticky top-2 z-10 flex items-center justify-between rounded-lg border bg-background/95 px-4 py-2 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span
                className={cn('font-mono font-semibold', remaining < 300 ? 'text-destructive' : '')}
              >
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
              <span className="text-muted-foreground">
                {t('answeredCount', { answered, total: questions.length })}
              </span>
            </div>
            <Button
              onClick={() => {
                if (window.confirm(t('confirmSubmit'))) submitMut.mutate()
              }}
              size="sm"
              disabled={submitMut.isPending}
            >
              {submitMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t('submit')}
            </Button>
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              {t('loadingQuestions')}
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <Card key={q.id}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <span className="mr-2 text-xs text-muted-foreground">
                          {idx + 1}.{' '}
                          {TYPE_LABEL[q.type] ? t(`typeLabel.${TYPE_LABEL[q.type]}`) : q.type}
                        </span>
                        <span className="text-sm font-medium">{q.title}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t('scorePoints', { score: Number(q.score) })}
                      </span>
                    </div>
                    <AnswerInput
                      question={q}
                      value={answers[q.id]}
                      onChange={(v) => setAns(q.id, v)}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function EduAnswerOnlinePage() {
  const t = useTranslations('admin.edu.answer.online')
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      }
    >
      <AnswerOnlineContent />
    </React.Suspense>
  )
}
