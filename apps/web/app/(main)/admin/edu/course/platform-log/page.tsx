'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { HasPermi } from '@/components/auth/HasPermi'
import { exportFromApi } from '@/lib/export-utils'
import { Button } from '@ihui/ui'

import { PlatformLogFilter } from './PlatformLogFilter'
import { PlatformLogTable } from './PlatformLogTable'
import { PlatformLogDialog } from './PlatformLogDialog'
import { PAGE_SIZE, PERM, EMPTY, EMPTY_SEARCH, EXPORT_COLUMNS, platformLogToForm } from './helpers'
import type { PlatformLog, CForm, Search } from './types'

export default function EduCoursePlatformLogPage() {
  const t = useTranslations('admin.edu.course.platformLog')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState<Search>(EMPTY_SEARCH)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PlatformLog | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course-platform-log', params],
    queryFn: () =>
      eduApi<PageData<PlatformLog>>(`/api/admin/course-platform-log${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        platformId: form.platformId,
        courseId: form.courseId,
        videoId: form.videoId,
        type: Number(form.type),
        creator: form.creator,
        sysCreator: form.sysCreator,
        createdAt: form.createdAt || undefined,
      }
      return editing
        ? eduApi(`/api/admin/course-platform-log/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : eduApi(`/api/admin/course-platform-log`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'course-platform-log'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      eduApi(`/api/admin/course-platform-log/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'course-platform-log'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: PlatformLog) {
    setEditing(r)
    setForm(platformLogToForm(r))
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
    if (!form.platformId.trim()) return setErr(t('platformIdRequired'))
    saveMut.mutate()
  }
  function handleDelete(r: PlatformLog) {
    if (!window.confirm(t('confirmDelete'))) return
    deleteMut.mutate(r.id)
  }
  function handleExport() {
    exportFromApi(
      `/api/admin/course-platform-log${buildQs({ ...q, pageSize: 10000 })}`,
      `coursePlatformLog_${Date.now()}`,
      EXPORT_COLUMNS,
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? t('exportSuccess') : t('exportFailed')))
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const set = (k: keyof Search, v: string) => {
    setQ((prev) => ({ ...prev, [k]: v }))
    setPage(1)
  }
  const resetQ = () => {
    setQ(EMPTY_SEARCH)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <HasPermi code={`${PERM}add`}>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4" />
              {t('create')}
            </Button>
          </HasPermi>
          <HasPermi code={`${PERM}export`}>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              {t('export')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PlatformLogFilter q={q} onChange={set} onReset={resetQ} />
      </div>

      <PlatformLogTable
        list={data?.list ?? []}
        isLoading={isLoading}
        error={error as Error | null}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletePending={deleteMut.isPending}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('totalItems', { count: total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prevPage')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('pageInfo', { page, totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('nextPage')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <PlatformLogDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
