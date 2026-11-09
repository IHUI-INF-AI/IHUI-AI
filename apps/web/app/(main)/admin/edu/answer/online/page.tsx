// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { confirmDialog } from '@/components/feedback'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Loader2, ChevronLeft, Clock, Send } from 'lucide-react'
import {
  getExamById,
  getExamPaper,
  getExams,
  startExam,
  submitExamRecord,
} from '@ihui/api-client'
import { cn } from '@/lib/utils'
import { useDeadlineCountdown } from '@/hooks/use-deadline-countdown'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { AnswerInput } from './AnswerInput'
import { PaperSelectCard } from './PaperSelectCard'
import { TYPE_LABEL_KEY } from './helpers'
import type { Paper, Question } from './types'
import { BackButton } from '@/components/common'

function AnswerOnlineContent() {
  const t = useTranslations('admin.edu.answer.online')
  const router = useRouter()
  const [paperId, setPaperId] = React.useState('')
  const [recordId, setRecordId] = React.useState<string | null>(null)
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({})
  // W-02:与考试端同型修复,以截止时间戳建模,剩余秒数由墙钟派生
  const [deadline, setDeadline] = React.useState<number | null>(null)

  const { data: papersData } = useQuery({
    queryKey: ['edu', 'answer', 'papers'],
    queryFn: async () => {
      const r = await getExams({ page: 1, pageSize: 100 })
      if (!r.success) throw new Error(r.error)
      return r.data as unknown as { list: Paper[] }
    },
  })
  const papers = (papersData?.list ?? []).filter((p) => p.isPublished)

  const { data: paper } = useQuery({
    queryKey: ['edu', 'answer', 'paper', paperId],
    queryFn: async () => {
      const r = await getExamPaper<{ paper: Paper }>(paperId)
      if (!r.success) throw new Error(r.error)
      return r.data.paper
    },
    enabled: !!paperId,
  })

  const { data: questionsData, isLoading } = useQuery({
    queryKey: ['edu', 'answer', 'questions', paperId],
    queryFn: async () => {
      const r = await getExamById(paperId)
      if (!r.success) throw new Error(r.error)
      return (r.data.questions ?? []) as unknown as Question[]
    },
    enabled: !!paperId,
  })
  const questions = questionsData ?? []

  const startMut = useMutation({
    mutationFn: async () => {
      const r = await startExam<{ record: { id: string } }>(paperId)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      setRecordId(d.record.id)
      autoSubmitRef.current = false
      const duration = paper?.duration ?? 0
      setDeadline(duration > 0 ? Date.now() + duration * 60_000 : null)
      toast.success(t('started'))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submitMut = useMutation({
    mutationFn: async () => {
      const arr = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }))
      const r = await submitExamRecord(recordId ?? '', { answers: arr })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d: unknown) => {
      toast.success(t('submitSuccess'))
      setRecordId(null)
      setAnswers({})
      setDeadline(null)
      router.push('/admin/edu/answer/card')
      void d
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submitMutRef = React.useRef(submitMut)
  submitMutRef.current = submitMut
  // 自动交卷一次性锁:避免归零后每次重渲染都重复提交
  const autoSubmitRef = React.useRef(false)

  const remaining = useDeadlineCountdown(deadline)

  React.useEffect(() => {
    if (!recordId || deadline === null || remaining > 0 || questions.length === 0) return
    if (autoSubmitRef.current || submitMutRef.current.isPending) return
    autoSubmitRef.current = true
    toast.warning(t('timeUpAutoSubmit'))
    submitMutRef.current.mutate()
  }, [remaining, recordId, deadline, questions.length, t])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const answered = Object.keys(answers).length

  function setAns(qid: string, v: unknown) {
    setAnswers({ ...answers, [qid]: v })
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-display font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-body text-muted-foreground">{t('subtitle')}</p>
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
          <div className="sticky top-2 z-20 flex items-center justify-between rounded-lg border bg-background/95 px-4 py-2 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-body">
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
                void confirmDialog({ title: t('confirmSubmit') }).then((ok) => {
                  if (ok) submitMut.mutate()
                })
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
                  <CardContent className="min-[640px]:p-3 p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <span className="mr-2 text-label text-muted-foreground">
                          {idx + 1}.{' '}
                          {TYPE_LABEL_KEY[q.type]
                            ? t(TYPE_LABEL_KEY[q.type] ?? 'typeLabel.unknown')
                            : q.type}
                        </span>
                        <span className="text-body font-medium">{q.title}</span>
                      </div>
                      <span className="shrink-0 text-label text-muted-foreground">
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
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      }
    >
      <AnswerOnlineContent />
    </React.Suspense>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
