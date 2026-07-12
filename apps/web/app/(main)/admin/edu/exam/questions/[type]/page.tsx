'use client'

import * as React from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ChevronLeft, Loader2 } from 'lucide-react'
import { eduApi } from '@/lib/edu'
import { Button } from '@ihui/ui'

import { QuestionFilter } from './QuestionFilter'
import { QuestionTable } from './QuestionTable'
import { QuestionDialog } from './QuestionDialog'
import { TYPE_LABEL, TYPE_API, EMPTY, questionToForm, buildBody } from './helpers'
import type { Paper, Question, QForm } from './types'

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
        body: JSON.stringify(buildBody(apiType, form)),
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
        body: JSON.stringify(buildBody(apiType, form)),
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

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(q: Question) {
    setEditing(q)
    setForm(questionToForm(q))
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
  function handleDelete(q: Question) {
    if (!window.confirm('确定删除？')) return
    deleteMut.mutate(q.id)
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
        <QuestionFilter paperId={paperId} onPaperChange={onPaperChange} papers={papers} />
        <Button onClick={openCreate} size="sm" className="ml-auto" disabled={!paperId}>
          <Plus className="h-4 w-4" />
          新建{label}
        </Button>
      </div>
      <QuestionTable
        list={questions}
        isLoading={isLoading}
        error={error as Error | null}
        hasPaper={!!paperId}
        label={label}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletePending={deleteMut.isPending}
      />
      <QuestionDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        saving={saving}
        label={label}
        onSubmit={submit}
        onClose={closeDialog}
      />
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
