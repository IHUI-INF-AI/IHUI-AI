'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Clock, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface Question {
  id: string
  title: string
  type: 'single' | 'multiple'
  options: { key: string; value: string }[]
}
interface ExamDetail {
  id: string
  title: string
  duration: number
  totalScore: number
  passScore: number
  questions: Question[]
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function EduExamTakePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [answers, setAnswers] = React.useState<Record<string, string[]>>({})
  const [current, setCurrent] = React.useState(0)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exam', id],
    queryFn: () => api<{ exam: ExamDetail }>(`/api/edu/exam/${id}`).then((d) => d.exam),
  })

  const submitMut = useMutation({
    mutationFn: () =>
      api<{ recordId: string }>(`/api/edu/exam/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers: Object.fromEntries(
            Object.entries(answers).map(([k, v]) => [k, v.length === 1 ? v[0] : v]),
          ),
        }),
      }),
    onSuccess: (r) => router.push(`/edu/exam/${id}/result?recordId=${r.recordId}`),
  })

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push('/edu/exam')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回考试列表
        </button>
        <Alert variant="danger" description={(error as Error)?.message ?? '考试不存在'} />
      </div>
    )
  }

  const exam = data
  const questions = exam.questions ?? []
  const q = questions[current]
  const answeredCount = Object.keys(answers).length

  const toggle = (qid: string, key: string, isSingle: boolean) => {
    setAnswers((a) => {
      const cur = a[qid] ?? []
      if (isSingle) return { ...a, [qid]: [key] }
      return {
        ...a,
        [qid]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
      }
    })
  }

  if (!q) {
    return (
      <div className="space-y-4">
        <Link
          href="/edu/exam"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回考试列表
        </Link>
        <Alert variant="info" description="暂无题目" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/edu/exam"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回考试列表
        </Link>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {exam.duration} 分钟
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <h1 className="text-lg font-semibold">{exam.title}</h1>
        <span className="text-muted-foreground">
          已答 {answeredCount} / {questions.length}
        </span>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm font-medium">
            第 {current + 1} 题 / 共 {questions.length} 题
            <span className="ml-2 text-xs text-muted-foreground">
              {q.type === 'single' ? '单选' : '多选'}
            </span>
          </p>
          <p className="text-base">{q.title}</p>
          <div className="space-y-2">
            {q.options.map((opt) => {
              const selected = (answers[q.id] ?? []).includes(opt.key)
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggle(q.id, opt.key, q.type === 'single')}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors',
                    selected ? 'border-primary bg-primary/5' : 'hover:bg-accent',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs',
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {opt.key}
                  </span>
                  <span>{opt.value}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={current === 0}
          onClick={() => setCurrent((c) => c - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          上一题
        </Button>
        {current < questions.length - 1 ? (
          <Button size="sm" onClick={() => setCurrent((c) => c + 1)}>
            下一题
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" disabled={submitMut.isPending} onClick={() => submitMut.mutate()}>
            {submitMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            提交考试
          </Button>
        )}
      </div>
      {submitMut.isError && (
        <Alert variant="danger" description={(submitMut.error as Error)?.message} />
      )}
    </div>
  )
}
