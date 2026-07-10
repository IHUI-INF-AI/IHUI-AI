'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, Clock, Send, FileText } from 'lucide-react'
import { eduApi, buildQs, selectClass } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
  Card, CardContent,
} from '@ihui/ui'

interface Paper { id: string; title: string; duration: number; isPublished: boolean; totalScore: string }
interface Question {
  id: string; type: string; title: string
  options: unknown; score: string; sortOrder: number
}

const TYPE_LABEL: Record<string, string> = {
  single_choice: '单选题', multi_choice: '多选题', judgment: '判断题',
  fill_blank: '填空题', subjective: '简答题', programming: '编程题',
}

function AnswerOnlineContent() {
  const router = useRouter()
  const [paperId, setPaperId] = React.useState('')
  const [recordId, setRecordId] = React.useState<string | null>(null)
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({})
  const [remaining, setRemaining] = React.useState<number>(0)

  const { data: papersData } = useQuery({
    queryKey: ['edu', 'answer', 'papers'],
    queryFn: () => eduApi<{ list: Paper[] }>(`/api/exam/papers${buildQs({ page: 1, pageSize: 100 })}`),
  })
  const papers = (papersData?.list ?? []).filter((p) => p.isPublished)

  const { data: paper } = useQuery({
    queryKey: ['edu', 'answer', 'paper', paperId],
    queryFn: () => eduApi<{ paper: Paper }>(`/api/exam/papers/${paperId}`).then((d) => d.paper),
    enabled: !!paperId,
  })

  const { data: questionsData, isLoading } = useQuery({
    queryKey: ['edu', 'answer', 'questions', paperId],
    queryFn: () => eduApi<{ list: Question[] }>(`/api/exam/papers/${paperId}/questions`).then((d) => d.list ?? []),
    enabled: !!paperId,
  })
  const questions = questionsData ?? []

  const startMut = useMutation({
    mutationFn: () => eduApi<{ record: { id: string } }>(`/api/exam/papers/${paperId}/start`, { method: 'POST' }),
    onSuccess: (d) => {
      setRecordId(d.record.id)
      if (paper) setRemaining(paper.duration * 60)
      toast.success('已开始答题')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submitMut = useMutation({
    mutationFn: () => {
      const arr = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }))
      return eduApi(`/api/exam/records/${recordId}/submit`, { method: 'POST', body: JSON.stringify({ answers: arr }) })
    },
    onSuccess: (d: unknown) => {
      toast.success('交卷成功')
      setRecordId(null)
      setAnswers({})
      setRemaining(0)
      router.push('/admin/edu/answer/card')
      void d
    },
    onError: (e: Error) => toast.error(e.message),
  })

  React.useEffect(() => {
    if (!recordId || remaining <= 0) return
    const t = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [recordId, remaining])

  React.useEffect(() => {
    if (recordId && remaining === 0 && questions.length > 0) {
      toast.warning('考试时间已到，自动交卷')
      submitMut.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, recordId, questions.length])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const answered = Object.keys(answers).length

  function setAns(qid: string, v: unknown) { setAnswers({ ...answers, [qid]: v }) }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">在线答题</h1>
          <p className="mt-1 text-sm text-muted-foreground">单选/多选/判断/填空/简答 在线作答</p>
        </div>
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu"><ChevronLeft className="h-4 w-4" />返回</Link></Button>
      </div>

      {!recordId ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="o-paper">选择试卷</Label>
              <Select value={paperId} onValueChange={setPaperId}>
                <SelectTrigger className={selectClass} id="o-paper"><SelectValue placeholder="选择已发布试卷" /></SelectTrigger>
                <SelectContent>{papers.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}（{p.duration}分钟）</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {paper && (
              <div className="grid grid-cols-3 gap-3 rounded-md bg-muted/40 px-4 py-3 text-sm">
                <div><span className="text-muted-foreground">总分：</span><b>{Number(paper.totalScore)}</b></div>
                <div><span className="text-muted-foreground">时长：</span><b>{paper.duration}分钟</b></div>
                <div><span className="text-muted-foreground">题目数：</span><b>{questions.length}</b></div>
              </div>
            )}
            <Button onClick={() => startMut.mutate()} disabled={!paperId || startMut.isPending || questions.length === 0}>
              {startMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              开始答题
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="sticky top-2 z-10 flex items-center justify-between rounded-lg border bg-background/95 px-4 py-2 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className={cn('font-mono font-semibold', remaining < 300 ? 'text-destructive' : '')}>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
              <span className="text-muted-foreground">已答 {answered}/{questions.length}</span>
            </div>
            <Button onClick={() => { if (window.confirm('确定交卷吗？')) submitMut.mutate() }} size="sm" disabled={submitMut.isPending}>
              {submitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              交卷
            </Button>
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载题目...</div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <Card key={q.id}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <span className="mr-2 text-xs text-muted-foreground">{idx + 1}. {TYPE_LABEL[q.type] ?? q.type}</span>
                        <span className="text-sm font-medium">{q.title}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{Number(q.score)}分</span>
                    </div>
                    <AnswerInput question={q} value={answers[q.id]} onChange={(v) => setAns(q.id, v)} />
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

function AnswerInput({ question, value, onChange }: { question: Question; value: unknown; onChange: (v: unknown) => void }) {
  const opts = Array.isArray(question.options) ? (question.options as Array<{ key: string; text: string }>) : []
  if (question.type === 'single_choice') {
    return (
      <div className="space-y-1">
        {opts.map((o) => (
          <label key={o.key} className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name={question.id} checked={value === o.key} onChange={() => onChange(o.key)} className="h-4 w-4" />
            <span><b className="mr-1">{o.key}.</b>{o.text}</span>
          </label>
        ))}
      </div>
    )
  }
  if (question.type === 'multi_choice') {
    const cur = Array.isArray(value) ? (value as string[]) : []
    function toggle(k: string) { onChange(cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]) }
    return (
      <div className="space-y-1">
        {opts.map((o) => (
          <label key={o.key} className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={cur.includes(o.key)} onChange={() => toggle(o.key)} className="h-4 w-4" />
            <span><b className="mr-1">{o.key}.</b>{o.text}</span>
          </label>
        ))}
      </div>
    )
  }
  if (question.type === 'judgment') {
    return (
      <div className="flex gap-4">
        <label className="flex cursor-pointer items-center gap-1 text-sm"><input type="radio" name={question.id} checked={value === true} onChange={() => onChange(true)} className="h-4 w-4" />正确</label>
        <label className="flex cursor-pointer items-center gap-1 text-sm"><input type="radio" name={question.id} checked={value === false} onChange={() => onChange(false)} className="h-4 w-4" />错误</label>
      </div>
    )
  }
  if (question.type === 'fill_blank') {
    return <Input value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} placeholder="多个空用 | 分隔" className="h-9" />
  }
  return <textarea value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} rows={4} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="请输入答案" />
}

export default function EduAnswerOnlinePage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />加载中...</div>}>
      <AnswerOnlineContent />
    </React.Suspense>
  )
}
