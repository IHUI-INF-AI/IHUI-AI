'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ListChecks, ChevronLeft } from 'lucide-react'
import { eduApi, selectClass, textareaClass } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@ihui/ui'

type QType = 'single_choice' | 'multi_choice' | 'judgment' | 'fill_blank' | 'subjective' | 'programming'

const TYPE_BADGE: Record<string, string> = {
  single_choice: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  multi_choice: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  judgment: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  fill_blank: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  subjective: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  programming: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
}

const TYPE_LABEL: Record<string, string> = {
  single_choice: '单选题',
  multi_choice: '多选题',
  judgment: '判断题',
  fill_blank: '填空题',
  subjective: '简答题',
  programming: '编程题',
}

const TYPES: { value: QType; label: string }[] = [
  { value: 'single_choice', label: '单选题' },
  { value: 'multi_choice', label: '多选题' },
  { value: 'judgment', label: '判断题' },
  { value: 'fill_blank', label: '填空题' },
  { value: 'subjective', label: '简答题' },
  { value: 'programming', label: '编程题' },
]

interface Paper { id: string; title: string; isPublished: boolean }
interface Question {
  id: string; paperId: string; type: QType; title: string
  options: unknown; score: string; sortOrder: number; answer?: unknown; analysis?: string
}

interface QForm {
  type: QType; title: string; score: string; sortOrder: string
  options: string; answer: string; analysis: string
}
const EMPTY: QForm = { type: 'single_choice', title: '', score: '5', sortOrder: '0', options: '', answer: '', analysis: '' }

function QuestionsContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const qc = useQueryClient()
  const initialPaper = sp.get('paperId') ?? ''
  const [paperId, setPaperId] = React.useState(initialPaper)
  const [typeFilter, setTypeFilter] = React.useState<string>('all')
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
    queryKey: ['edu', 'exam', 'questions', paperId],
    queryFn: () => eduApi<{ list: Question[] }>(`/api/admin/exam/papers/${paperId}/questions`).then((d) => d.list ?? []),
    enabled: !!paperId,
  })

  const createMut = useMutation({
    mutationFn: () => eduApi(`/api/admin/exam/papers/${paperId}/questions`, { method: 'POST', body: JSON.stringify(buildBody()) }),
    onSuccess: () => { toast.success('创建成功'); qc.invalidateQueries({ queryKey: ['edu', 'exam', 'questions', paperId] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const updateMut = useMutation({
    mutationFn: () => eduApi(`/api/admin/exam/questions/${editing?.id}`, { method: 'PUT', body: JSON.stringify(buildBody()) }),
    onSuccess: () => { toast.success('更新成功'); qc.invalidateQueries({ queryKey: ['edu', 'exam', 'questions', paperId] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/exam/questions/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['edu', 'exam', 'questions', paperId] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function buildBody() {
    const body: Record<string, unknown> = {
      type: form.type, title: form.title.trim(), score: form.score, sortOrder: Number(form.sortOrder) || 0,
    }
    if (form.options.trim()) body.options = JSON.parse(form.options)
    if (form.answer.trim()) body.answer = JSON.parse(form.answer)
    if (form.analysis.trim()) body.analysis = form.analysis.trim()
    return body
  }
  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(q: Question) {
    setEditing(q)
    setForm({
      type: q.type, title: q.title, score: q.score, sortOrder: String(q.sortOrder),
      options: q.options ? JSON.stringify(q.options, null, 2) : '',
      answer: q.answer ? JSON.stringify(q.answer, null, 2) : '',
      analysis: q.analysis || '',
    })
    setErr(null); setOpen(true)
  }
  function closeDialog() {
    if (createMut.isPending || updateMut.isPending) return
    setOpen(false); setEditing(null); setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null)
    if (!paperId) return setErr('请先选择试卷')
    if (!form.title.trim()) return setErr('题干不能为空')
    try { if (form.options.trim()) JSON.parse(form.options) } catch (e) { return setErr(`选项JSON错误：${(e as Error).message}`) }
    try { if (form.answer.trim()) JSON.parse(form.answer) } catch (e) { return setErr(`答案JSON错误：${(e as Error).message}`) }
    if (editing) updateMut.mutate(); else createMut.mutate()
  }
  function onPaperChange(v: string) {
    setPaperId(v)
    const p = new URLSearchParams(sp.toString())
    if (v) p.set('paperId', v); else p.delete('paperId')
    router.replace(`/admin/edu/exam/questions?${p.toString()}`)
  }

  const all = data ?? []
  const questions = typeFilter === 'all' ? all : all.filter((q) => q.type === typeFilter)
  const saving = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">题库管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理单选/多选/判断/填空/简答/编程 六种题型</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/exam"><ChevronLeft className="h-4 w-4" />返回考试管理</Link>
        </Button>
        <div className="w-full max-w-sm">
          <Select value={paperId} onValueChange={onPaperChange}>
            <SelectTrigger className={selectClass} aria-label="选择试卷"><SelectValue placeholder="请选择试卷" /></SelectTrigger>
            <SelectContent>
              {papers.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.title}{!p.isPublished ? '（未发布）' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full max-w-[160px]">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className={selectClass} aria-label="题型筛选"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部题型</SelectItem>
              {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto" disabled={!paperId}>
          <Plus className="h-4 w-4" />新建题目
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">题型</TableHead>
              <TableHead className="px-4 py-2.5">题干</TableHead>
              <TableHead className="px-4 py-2.5">分值</TableHead>
              <TableHead className="px-4 py-2.5">排序</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {!paperId ? (
              <TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><ListChecks className="mx-auto mb-2 h-8 w-8 opacity-40" />请先选择试卷</TableCell></TableRow>
            ) : isLoading ? (
              <TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</TableCell></TableRow>
            ) : questions.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><ListChecks className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无题目</TableCell></TableRow>
            ) : (
              questions.map((q) => (
                <TableRow key={q.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', TYPE_BADGE[q.type])}>{TYPE_LABEL[q.type] ?? q.type}</span>
                  </TableCell>
                  <TableCell className="max-w-md truncate px-4 py-2.5">{q.title}</TableCell>
                  <TableCell className="px-4 py-2.5">{Number(q.score)}</TableCell>
                  <TableCell className="px-4 py-2.5">{q.sortOrder}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(q)} title="编辑"><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('确定删除该题目？')) deleteMut.mutate(q.id) }} title="删除" className="text-destructive hover:text-destructive" disabled={deleteMut.isPending}><Trash2 className="h-4 w-4" /></Button>
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
            <DialogHeader><DialogTitle>{editing ? '编辑题目' : '新建题目'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="q-type">题型</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as QType })}>
                  <SelectTrigger className={selectClass} id="q-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-score">分值</Label>
                <Input id="q-score" type="number" min="0" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-title">题干</Label>
              <textarea id="q-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} rows={2} className={cn(textareaClass, 'font-sans')} placeholder="请输入题干内容" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="q-options">选项 (JSON)</Label>
                <textarea id="q-options" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} rows={4} className={textareaClass} placeholder='[{"key":"A","text":"选项一"}]' />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-answer">答案 (JSON)</Label>
                <textarea id="q-answer" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={4} className={textareaClass} placeholder='"A" 或 ["A","B"] 或 true' />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="q-sort">排序</Label>
                <Input id="q-sort" type="number" min="0" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-analysis">解析</Label>
                <Input id="q-analysis" value={form.analysis} onChange={(e) => setForm({ ...form, analysis: e.target.value })} placeholder="解析(选填)" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>取消</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function EduExamQuestionsPage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />加载中...</div>}>
      <QuestionsContent />
    </React.Suspense>
  )
}
