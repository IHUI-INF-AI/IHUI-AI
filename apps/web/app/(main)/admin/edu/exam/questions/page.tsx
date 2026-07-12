'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { eduApi } from '@/lib/edu'

import { EMPTY } from './helpers'
import type { Paper, Question, QForm } from './types'
import { QuestionsFilter } from './QuestionsFilter'
import { QuestionsTable } from './QuestionsTable'
import { QuestionsDialog } from './QuestionsDialog'

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
    queryFn: () =>
      eduApi<{ list: Question[] }>(`/api/admin/exam/papers/${paperId}/questions`).then(
        (d) => d.list ?? [],
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
      type: form.type,
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
      type: q.type,
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
    router.replace(`/admin/edu/exam/questions?${p.toString()}`)
  }
  function handleDelete(q: Question) {
    if (!window.confirm('确定删除该题目？')) return
    deleteMut.mutate(q.id)
  }

  const all = data ?? []
  const questions = typeFilter === 'all' ? all : all.filter((q) => q.type === typeFilter)
  const saving = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">题库管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理单选/多选/判断/填空/简答/编程 六种题型
        </p>
      </div>

      <QuestionsFilter
        paperId={paperId}
        onPaperChange={onPaperChange}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        papers={papers}
        onCreate={openCreate}
      />

      <QuestionsTable
        rows={questions}
        isLoading={isLoading}
        error={error as Error | null}
        hasPaperId={!!paperId}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletePending={deleteMut.isPending}
      />

      <QuestionsDialog
        open={open}
        editing={editing}
        form={form}
        onFormChange={(patch) => setForm({ ...form, ...patch })}
        onClose={closeDialog}
        onSubmit={submit}
        pending={saving}
        err={err}
      />
    </div>
  )
}

export default function EduExamQuestionsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      }
    >
      <QuestionsContent />
    </React.Suspense>
  )
}
