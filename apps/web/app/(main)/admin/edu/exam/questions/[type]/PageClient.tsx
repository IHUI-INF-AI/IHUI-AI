'use client'

import * as React from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ChevronLeft, Loader2 } from 'lucide-react'
import { eduApi } from '@/lib/edu'
import { Button } from '@ihui/ui-react'

import { QuestionFilter } from './QuestionFilter'
import { QuestionTable } from './QuestionTable'
import { QuestionDialog } from './QuestionDialog'
import { TYPE_LABEL, TYPE_API, EMPTY, questionToForm, buildBody } from './helpers'
import type { Paper, Question, QForm } from './types'

function TypeQuestionsContent() {
  const t = useTranslations('admin.edu.exam.questionsType')
  const params = useParams<{ type: string }>()
  const router = useRouter()
  const sp = useSearchParams()
  const qc = useQueryClient()
  const typeKey = params.type
  const apiType = TYPE_API[typeKey] ?? typeKey
  const label = t(TYPE_LABEL[typeKey] ?? typeKey)
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
      toast.success(t('createSuccess'))
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
      toast.success(t('updateSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'questions', paperId] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/exam/questions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
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
    if (!paperId) return setErr(t('paperRequired'))
    if (!form.title.trim()) return setErr(t('titleRequired'))
    try {
      if (form.options.trim()) JSON.parse(form.options)
    } catch (e) {
      return setErr(t('optionsJsonError', { message: (e as Error).message }))
    }
    try {
      if (form.answer.trim()) JSON.parse(form.answer)
    } catch (e) {
      return setErr(t('answerJsonError', { message: (e as Error).message }))
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
    if (!window.confirm(t('confirmDelete'))) return
    deleteMut.mutate(q.id)
  }

  const questions = data ?? []
  const saving = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('titleWithType', { type: label })}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('subtitleWithType', { type: label })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/exam/questions">
            <ChevronLeft className="h-4 w-4" />
            {t('backToQuestions')}
          </Link>
        </Button>
        <QuestionFilter paperId={paperId} onPaperChange={onPaperChange} papers={papers} />
        <Button onClick={openCreate} size="sm" className="ml-auto" disabled={!paperId}>
          <Plus className="h-4 w-4" />
          {t('createWithType', { type: label })}
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
  const t = useTranslations('admin.edu.exam.questionsType')
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      }
    >
      <TypeQuestionsContent />
    </React.Suspense>
  )
}
