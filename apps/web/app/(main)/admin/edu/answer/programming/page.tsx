'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Loader2, ChevronLeft } from 'lucide-react'
import { eduApi, buildQs } from '@/lib/edu'
import { Button } from '@ihui/ui-react'

import type { Paper, Question } from './types'
import { ProgrammingSelector } from './ProgrammingSelector'
import { ProgrammingQuestion } from './ProgrammingQuestion'
import { ProgrammingEditor } from './ProgrammingEditor'

function ProgrammingContent() {
  const t = useTranslations('admin.edu.answer.programming')
  const [paperId, setPaperId] = React.useState('')
  const [qIdx, setQIdx] = React.useState(0)
  const [lang, setLang] = React.useState('javascript')
  const [code, setCode] = React.useState('')
  const [recordId, setRecordId] = React.useState<string | null>(null)
  const [runResult, setRunResult] = React.useState<{ pass: boolean; output: string } | null>(null)

  const { data: papersData } = useQuery({
    queryKey: ['edu', 'answer', 'prog', 'papers'],
    queryFn: () =>
      eduApi<{ list: Paper[] }>(`/api/exam/papers${buildQs({ page: 1, pageSize: 100 })}`),
  })
  const papers = (papersData?.list ?? []).filter((p) => p.isPublished)

  const { data: questionsData, isLoading } = useQuery({
    queryKey: ['edu', 'answer', 'prog', 'questions', paperId],
    queryFn: () =>
      eduApi<{ list: Question[] }>(`/api/exam/papers/${paperId}/questions`).then((d) =>
        (d.list ?? []).filter((q) => q.type === 'programming'),
      ),
    enabled: !!paperId,
  })
  const questions = questionsData ?? []
  const current = questions[qIdx]

  const startMut = useMutation({
    mutationFn: () =>
      eduApi<{ record: { id: string } }>(`/api/exam/papers/${paperId}/start`, { method: 'POST' }),
    onSuccess: (d) => {
      setRecordId(d.record.id)
      toast.success(t('started'))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const runMut = useMutation({
    mutationFn: () =>
      eduApi<{ pass: boolean; output: string; expected?: string }>(
        `/api/admin/edu/answer/run-code`,
        { method: 'POST', body: JSON.stringify({ language: lang, code, questionId: current?.id }) },
      ),
    onSuccess: (d) => {
      setRunResult({ pass: d.pass, output: d.output ?? '' })
      toast[d.pass ? 'success' : 'error'](d.pass ? t('passedTest') : t('notPassed'))
    },
    onError: (e: Error) => {
      setRunResult({ pass: false, output: e.message })
      toast.error(e.message)
    },
  })

  const submitMut = useMutation({
    mutationFn: () => {
      const answer = { language: lang, code }
      return eduApi(`/api/exam/records/${recordId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: [{ questionId: current?.id, answer }] }),
      })
    },
    onSuccess: () => {
      toast.success(t('submitted'))
      if (qIdx < questions.length - 1) {
        setQIdx(qIdx + 1)
        setCode('')
        setRunResult(null)
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

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

      <ProgrammingSelector
        papers={papers}
        paperId={paperId}
        lang={lang}
        questions={questions}
        recordId={recordId}
        onPaperChange={(v) => {
          setPaperId(v)
          setQIdx(0)
          setRecordId(null)
          setCode('')
          setRunResult(null)
        }}
        onLangChange={setLang}
        onStart={() => startMut.mutate()}
        startPending={startMut.isPending}
      />

      {recordId && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ProgrammingQuestion
            current={current}
            qIdx={qIdx}
            questions={questions}
            isLoading={isLoading}
            onPrev={() => {
              setQIdx(qIdx - 1)
              setCode('')
              setRunResult(null)
            }}
            onNext={() => {
              setQIdx(qIdx + 1)
              setCode('')
              setRunResult(null)
            }}
          />
          <ProgrammingEditor
            code={code}
            onCodeChange={setCode}
            lang={lang}
            current={current}
            onRun={() => runMut.mutate()}
            onSubmit={() => {
              if (window.confirm(t('confirmSubmit'))) submitMut.mutate()
            }}
            runPending={runMut.isPending}
            submitPending={submitMut.isPending}
            runResult={runResult}
          />
        </div>
      )}
    </div>
  )
}

export default function EduAnswerProgrammingPage() {
  const t = useTranslations('admin.edu.answer.programming')
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      }
    >
      <ProgrammingContent />
    </React.Suspense>
  )
}
