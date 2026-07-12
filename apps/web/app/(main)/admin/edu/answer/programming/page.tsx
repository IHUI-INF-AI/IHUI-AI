'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Loader2, ChevronLeft, Play, Send, Code2, CheckCircle2, XCircle } from 'lucide-react'
import { eduApi, buildQs, selectClass, textareaClass } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Button,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Card,
  CardContent,
} from '@ihui/ui'

interface Paper {
  id: string
  title: string
  isPublished: boolean
}
interface Question {
  id: string
  type: string
  title: string
  options: unknown
  score: string
}

const LANGS = ['javascript', 'typescript', 'python', 'java', 'cpp', 'go']

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

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-paper">{t('selectPaper')}</Label>
              <Select
                value={paperId}
                onValueChange={(v) => {
                  setPaperId(v)
                  setQIdx(0)
                  setRecordId(null)
                  setCode('')
                  setRunResult(null)
                }}
              >
                <SelectTrigger className={selectClass} id="p-paper">
                  <SelectValue placeholder={t('selectPaperPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {papers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-lang">{t('language')}</Label>
              <Select value={lang} onValueChange={setLang}>
                <SelectTrigger className={selectClass} id="p-lang">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {paperId && !recordId && (
            <Button
              onClick={() => startMut.mutate()}
              disabled={startMut.isPending || questions.length === 0}
            >
              {startMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Code2 className="h-4 w-4" />
              )}
              {t('startWithCount', { count: questions.length })}
            </Button>
          )}
        </CardContent>
      </Card>

      {recordId && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={qIdx <= 0}
                        onClick={() => {
                          setQIdx(qIdx - 1)
                          setCode('')
                          setRunResult(null)
                        }}
                      >
                        {t('prevQuestion')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={qIdx >= questions.length - 1}
                        onClick={() => {
                          setQIdx(qIdx + 1)
                          setCode('')
                          setRunResult(null)
                        }}
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

          <Card>
            <CardContent className="space-y-3 p-4">
              <Label htmlFor="p-code">{t('codeEditor')}</Label>
              <textarea
                id="p-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={14}
                className={cn(textareaClass, 'text-xs')}
                placeholder={t('codePlaceholder', { lang })}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => runMut.mutate()}
                  size="sm"
                  variant="outline"
                  disabled={!current || !code || runMut.isPending}
                >
                  {runMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {t('runTest')}
                </Button>
                <Button
                  onClick={() => {
                    if (window.confirm(t('confirmSubmit'))) submitMut.mutate()
                  }}
                  size="sm"
                  disabled={!current || !code || submitMut.isPending}
                >
                  {submitMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {t('submit')}
                </Button>
              </div>
              {runResult && (
                <div
                  className={cn(
                    'rounded-md border p-3 text-sm',
                    runResult.pass
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-rose-500/30 bg-rose-500/5',
                  )}
                >
                  <div className="mb-1 flex items-center gap-1 font-medium">
                    {runResult.pass ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-600" />
                    )}
                    {runResult.pass ? t('passed') : t('notPassed')}
                  </div>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                    {runResult.output}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
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
