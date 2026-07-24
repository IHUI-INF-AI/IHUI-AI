'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { ChapterFilter } from './ChapterFilter'
import { ChapterTable } from './ChapterTable'
import { ChapterDialog } from './ChapterDialog'
import { api, EMPTY_FORM } from './helpers'
import type { Chapter, ChapterForm, ChaptersData, LessonsData } from './types'

function ChaptersContent() {
  const t = useTranslations('admin.learn')
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()

  const initialLessonId = searchParams.get('lessonId') ?? ''
  const [lessonId, setLessonId] = React.useState(initialLessonId)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Chapter | null>(null)
  const [form, setForm] = React.useState<ChapterForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: lessonsData } = useQuery({
    queryKey: ['admin', 'learn', 'lessons', 'all'],
    queryFn: () => api<LessonsData>(`/api/admin/learn/lessons?page=1&pageSize=100`),
  })
  const lessons = lessonsData?.list ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'learn', 'chapters', lessonId],
    queryFn: () =>
      api<ChaptersData>(`/api/admin/learn/lessons/${lessonId}/chapters`).then((d) => d.list ?? []),
    enabled: !!lessonId,
  })

  const createMut = useMutation({
    mutationFn: () => {
      const body = { title: form.title.trim(), sortOrder: Number(form.sortOrder) || 0 }
      return api(`/api/admin/learn/lessons/${lessonId}/chapters`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'learn', 'chapters', lessonId] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const updateMut = useMutation({
    mutationFn: () => {
      const body = { title: form.title.trim(), sortOrder: Number(form.sortOrder) || 0 }
      return api(`/api/admin/learn/lessons/${lessonId}/chapters/${editing?.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('updateSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'learn', 'chapters', lessonId] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/learn/lessons/${lessonId}/chapters/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'learn', 'chapters', lessonId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(ch: Chapter) {
    setEditing(ch)
    setForm({ title: ch.title, sortOrder: String(ch.sortOrder) })
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
    if (!lessonId) {
      setErr(t('selectLessonPlaceholder'))
      return
    }
    if (!form.title.trim()) {
      setErr(t('titleRequired'))
      return
    }
    if (editing) updateMut.mutate()
    else createMut.mutate()
  }

  function handleDelete(ch: Chapter) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(ch.id)
  }

  function onLessonChange(v: string) {
    setLessonId(v)
    const params = new URLSearchParams(searchParams.toString())
    if (v) params.set('lessonId', v)
    else params.delete('lessonId')
    router.replace(`/admin/learn/chapters?${params.toString()}`)
  }

  const chapters = data ?? []
  const saving = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('chaptersTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('chaptersSubtitle')}</p>
      </div>

      <ChapterFilter
        lessonId={lessonId}
        onLessonChange={onLessonChange}
        lessons={lessons}
        onCreate={openCreate}
      />

      <ChapterTable
        list={chapters}
        isLoading={isLoading}
        error={error as Error | null}
        lessonId={lessonId}
        deletePending={deleteMut.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <ChapterDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        saving={saving}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}

export default function AdminLearnChaptersPage() {
  const t = useTranslations('admin.learn')
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      }
    >
      <ChaptersContent />
    </React.Suspense>
  )
}
