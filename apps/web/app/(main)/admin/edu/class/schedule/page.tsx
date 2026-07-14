'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { Button } from '@ihui/ui'

import { EMPTY, PAGE_SIZE } from './helpers'
import type { Schedule, SForm } from './types'
import { ScheduleTable } from './ScheduleTable'
import { ScheduleDialog } from './ScheduleDialog'

export default function EduClassSchedulePage() {
  const t = useTranslations('admin.eduClassSchedule')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Schedule | null>(null)
  const [form, setForm] = React.useState<SForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'class', 'schedule', page],
    queryFn: () =>
      eduApi<PageData<Schedule>>(
        `/api/admin/edu/classes/schedules${buildQs({ page, pageSize: PAGE_SIZE })}`,
      ),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        classId: form.classId,
        title: form.title.trim(),
        teacherName: form.teacherName.trim() || null,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location.trim() || null,
      }
      if (editing)
        return eduApi(`/api/admin/edu/classes/schedules/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/edu/classes/schedules`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'class', 'schedule'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      eduApi(`/api/admin/edu/classes/schedules/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'class', 'schedule'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(s: Schedule) {
    setEditing(s)
    setForm({
      classId: s.classId,
      title: s.title,
      teacherName: s.teacherName ?? '',
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location ?? '',
    })
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.title.trim()) return setErr(t('titleRequired'))
    if (!form.classId.trim()) return setErr(t('classIdRequired'))
    saveMut.mutate()
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/class">
            <ChevronLeft className="h-4 w-4" />
            {t('backToClass')}
          </Link>
        </Button>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>
      <ScheduleTable
        rows={rows}
        isLoading={isLoading}
        error={error}
        onEdit={openEdit}
        onDelete={(s) => {
          if (window.confirm(t('deleteConfirm'))) deleteMut.mutate(s.id)
        }}
        deletePending={deleteMut.isPending}
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">{t('pageOf', { page, totalPages })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScheduleDialog
        open={open}
        editing={editing}
        form={form}
        onFormChange={(patch) => setForm({ ...form, ...patch })}
        onClose={closeDialog}
        onSubmit={submit}
        pending={saveMut.isPending}
        err={err}
      />
    </div>
  )
}
