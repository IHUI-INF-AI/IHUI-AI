'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Plus, ChevronLeft } from 'lucide-react'
import { eduApi, buildQs, selectClass } from '@/lib/edu'
import { Button, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'

import { EMPTY_CH } from './helpers'
import type { Lesson, Chapter, ChForm } from './types'
import { ChapterList } from './ChapterList'
import { ChapterDialog } from './ChapterDialog'

export default function EduCourseChaptersPage() {
  const t = useTranslations('admin.edu.course.chapters')
  const qc = useQueryClient()
  const [lessonId, setLessonId] = React.useState('')
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [chOpen, setChOpen] = React.useState(false)
  const [editingCh, setEditingCh] = React.useState<Chapter | null>(null)
  const [chForm, setChForm] = React.useState<ChForm>(EMPTY_CH)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: lessonsData } = useQuery({
    queryKey: ['edu', 'course', 'chapters', 'lessons'],
    queryFn: () =>
      eduApi<{ list: Lesson[] }>(`/api/admin/learn/lessons${buildQs({ page: 1, pageSize: 100 })}`),
  })
  const lessons = lessonsData?.list ?? []

  const {
    data: chapters,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['edu', 'course', 'chapters', lessonId],
    queryFn: async () => {
      const list = await eduApi<Chapter[]>(`/api/learn/lessons/${lessonId}`)
      return list ?? []
    },
    enabled: !!lessonId,
    retry: false,
  })

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveChMut = useMutation({
    mutationFn: () => {
      const body = { title: chForm.title.trim(), sortOrder: Number(chForm.sortOrder) || 0 }
      if (editingCh)
        return eduApi(`/api/admin/learn/lessons/${lessonId}/chapters/${editingCh.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/learn/lessons/${lessonId}/chapters`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editingCh ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'course', 'chapters', lessonId] })
      closeChDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteChMut = useMutation({
    mutationFn: (id: string) =>
      eduApi(`/api/admin/learn/lessons/${lessonId}/chapters/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'course', 'chapters', lessonId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreateCh() {
    setEditingCh(null)
    setChForm(EMPTY_CH)
    setErr(null)
    setChOpen(true)
  }
  function openEditCh(c: Chapter) {
    setEditingCh(c)
    setChForm({ title: c.title, sortOrder: String(c.sortOrder) })
    setErr(null)
    setChOpen(true)
  }
  function closeChDialog() {
    if (saveChMut.isPending) return
    setChOpen(false)
    setEditingCh(null)
    setErr(null)
  }
  function submitCh(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!chForm.title.trim()) return setErr(t('titleRequired'))
    saveChMut.mutate()
  }

  const rows = chapters ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/course">
            <ChevronLeft className="h-4 w-4" />
            {t('backToCourse')}
          </Link>
        </Button>
        <div className="w-full max-w-xs">
          <Select
            value={lessonId || 'none'}
            onValueChange={(v) => setLessonId(v === 'none' ? '' : v)}
          >
            <SelectTrigger className={selectClass} aria-label={t('course')}>
              <SelectValue placeholder={t('selectCoursePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('pleaseSelectCourse')}</SelectItem>
              {lessons.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {lessonId && (
          <Button onClick={openCreateCh} size="sm" className="ml-auto">
            <Plus className="h-4 w-4" />
            {t('createChapter')}
          </Button>
        )}
      </div>
      <ChapterList
        rows={rows}
        isLoading={isLoading}
        error={error}
        lessonId={lessonId}
        expanded={expanded}
        onToggleExpand={toggleExpand}
        onEdit={openEditCh}
        onDelete={(c) => {
          if (window.confirm(t('confirmDelete'))) deleteChMut.mutate(c.id)
        }}
        deletePending={deleteChMut.isPending}
      />
      <ChapterDialog
        open={chOpen}
        editing={editingCh}
        form={chForm}
        onFormChange={(patch) => setChForm({ ...chForm, ...patch })}
        onClose={closeChDialog}
        onSubmit={submitCh}
        pending={saveChMut.isPending}
        err={err}
      />
    </div>
  )
}
