'use client'

import * as React from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ListChecks, ChevronLeft } from 'lucide-react'
import { eduApi, selectClass, textareaClass } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui'

const TYPE_LABEL: Record<string, string> = {
  single: '单选题',
  multi: '多选题',
  judgment: '判断题',
  fill: '填空题',
  subjective: '简答题',
  programming: '编程题',
}
const TYPE_API: Record<string, string> = {
  single: 'single_choice',
  multi: 'multi_choice',
  judgment: 'judgment',
  fill: 'fill_blank',
  subjective: 'subjective',
  programming: 'programming',
}

interface Paper {
  id: string
  title: string
  isPublished: boolean
}
interface Question {
  id: string
  paperId: string
  type: string
  title: string
  options: unknown
  score: string
  sortOrder: number
  answer?: unknown
  analysis?: string
}
interface QForm {
  title: string
  score: string
  sortOrder: string
  options: string
  answer: string
  analysis: string
}
const EMPTY: QForm = {
  title: '',
  score: '5',
  sortOrder: '0',
  options: '',
  answer: '',
  analysis: '',
}

function TypeQuestionsContent() {
  const params = useParams<{ type: string }>()
  const router = useRouter()
  const sp = useSearchParams()
  const qc = useQueryClient()
  const typeKey = params.type
  const apiType = TYPE_API[typeKey] ?? typeKey
  const label = TYPE_LABEL[typeKey] ?? typeKey
  const initialPaper = sp.get('paperId') ?? ''
  const [paperId, setPaperId] = React.useState(initialPaper)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Question | null>(null)
  const [form, setForm] = React.useState<QForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: papersData } = useQuery({
    queryKey: ['edu', 'exam', 'papers', 'all'],
    queryFn: () => eduApi<{ list: Paper[] }>(`/api/admin/exam/papers?page=1&pageSize=100`),
  })
  const papers = papersData?.list ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exam', 'questions', paperId, apiType],
    queryFn: () =>
      eduApi<{ list: Question[] }>(`/api/admin/exam/papers/${paperId}/questions`).then((d) =>
        (d.list ?? []).filter((q) => q.type === apiType),
      ),
    enabled: !!paperId,
  })

  const createMut = useMutation({
    mutationFn: () =>
      eduApi(`/api/admin/exam/papers/${paperId}/questions`, {
        method: 'POST',
        body: JSON.stringify(buildBody()),
      }),
    onSuccess: () => {
      toast.success('创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'questions', paperId] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const updateMut = useMutation({
    mutationFn: () =>
      eduApi(`/api/admin/exam/questions/${editing?.id}`, {
        method: 'PUT',
        body: JSON.stringify(buildBody()),
      }),
    onSuccess: () => {
      toast.success('更新成功')
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'questions', paperId] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/exam/questions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'questions', paperId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function buildBody() {
    const body: Record<string, unknown> = {
      type: apiType,
      title: form.title.trim(),
      score: form.score,
      sortOrder: Number(form.sortOrder) || 0,
    }
    if (form.options.trim()) body.options = JSON.parse(form.options)
    if (form.answer.trim()) body.answer = JSON.parse(form.answer)
    if (form.analysis.trim()) body.analysis = form.analysis.trim()
    return body
  }
  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(q: Question) {
    setEditing(q)
    setForm({
      title: q.title,
      score: q.score,
      sortOrder: String(q.sortOrder),
      options: q.options ? JSON.stringify(q.options, null, 2) : '',
      answer: q.answer ? JSON.stringify(q.answer, null, 2) : '',
      analysis: q.analysis || '',
    })
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (createMut.isPending || updateMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!paperId) return setErr('请先选择试卷')
    if (!form.title.trim()) return setErr('题干不能为空')
    try {
      if (form.options.trim()) JSON.parse(form.options)
    } catch (e) {
      return setErr(`选项JSON错误：${(e as Error).message}`)
    }
    try {
      if (form.answer.trim()) JSON.parse(form.answer)
    } catch (e) {
      return setErr(`答案JSON错误：${(e as Error).message}`)
    }
    if (editing) updateMut.mutate()
    else createMut.mutate()
  }
  function onPaperChange(v: string) {
    setPaperId(v)
    const p = new URLSearchParams(sp.toString())
    if (v) p.set('paperId', v)
    else p.delete('paperId')
    router.replace(`/admin/edu/exam/questions/${typeKey}?${p.toString()}`)
  }

  const questions = data ?? []
  const saving = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{label}管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理试卷中的{label}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/exam/questions">
            <ChevronLeft className="h-4 w-4" />
            返回题库
          </Link>
        </Button>
        <div className="w-full max-w-sm">
          <select
            className={selectClass}
            value={paperId}
            onChange={(e) => onPaperChange(e.target.value)}
            aria-label="选择试卷"
          >
            <option value="">请选择试卷</option>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {!p.isPublished ? '（未发布）' : ''}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto" disabled={!paperId}>
          <Plus className="h-4 w-4" />
          新建{label}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">题干</TableHead>
              <TableHead className="px-4 py-2.5">分值</TableHead>
              <TableHead className="px-4 py-2.5">排序</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {!paperId ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <ListChecks className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  请先选择试卷
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : questions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <ListChecks className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无{label}
                </TableCell>
              </TableRow>
            ) : (
              questions.map((q) => (
                <TableRow key={q.id} className="hover:bg-muted/30">
                  <TableCell className="max-w-md break-words px-4 py-2.5">{q.title}</TableCell>
                  <TableCell className="px-4 py-2.5">{Number(q.score)}</TableCell>
                  <TableCell className="px-4 py-2.5">{q.sortOrder}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(q)} title="编辑">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm('确定删除？')) deleteMut.mutate(q.id)
                        }}
                        title="删除"
                        className="text-destructive hover:text-destructive"
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? `编辑${label}` : `新建${label}`}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="t-title">题干</Label>
              <textarea
                id="t-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                rows={2}
                className={cn(textareaClass, 'font-sans')}
                placeholder="请输入题干内容"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="t-score">分值</Label>
                <Input
                  id="t-score"
                  type="number"
                  min="0"
                  value={form.score}
                  onChange={(e) => setForm({ ...form, score: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-sort">排序</Label>
                <Input
                  id="t-sort"
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="t-options">选项 (JSON)</Label>
                <textarea
                  id="t-options"
                  value={form.options}
                  onChange={(e) => setForm({ ...form, options: e.target.value })}
                  rows={4}
                  className={textareaClass}
                  placeholder='[{"key":"A","text":"选项一"}]'
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-answer">答案 (JSON)</Label>
                <textarea
                  id="t-answer"
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  rows={4}
                  className={textareaClass}
                  placeholder='"A" / ["A","B"] / true'
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-analysis">解析</Label>
              <Input
                id="t-analysis"
                value={form.analysis}
                onChange={(e) => setForm({ ...form, analysis: e.target.value })}
                placeholder="解析(选填)"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                取消
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function EduExamTypeQuestionsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      }
    >
      <TypeQuestionsContent />
    </React.Suspense>
  )
}
