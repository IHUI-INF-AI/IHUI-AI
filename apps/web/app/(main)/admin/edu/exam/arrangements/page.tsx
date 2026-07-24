'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { Button } from '@ihui/ui-react'

import { ArrangementsFilter } from './ArrangementsFilter'
import { ArrangementsTable } from './ArrangementsTable'
import { ArrangementsDialog } from './ArrangementsDialog'
import { PAGE_SIZE, EMPTY, arrangementToForm } from './helpers'
import type { AForm, Arrangement, Paper } from './types'

export default function EduExamArrangementsPage() {
  const t = useTranslations('admin.edu.exam.arrangements')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Arrangement | null>(null)
  const [form, setForm] = React.useState<AForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: papersData } = useQuery({
    queryKey: ['edu', 'exam', 'papers', 'all'],
    queryFn: () => eduApi<{ list: Paper[] }>(`/api/admin/exam/papers?page=1&pageSize=100`),
  })
  const papers = papersData?.list ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exam', 'arrangements', page],
    queryFn: () =>
      eduApi<PageData<Arrangement>>(
        `/api/admin/edu/exam/arrangements${buildQs({ page, pageSize: PAGE_SIZE })}`,
      ),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { ...form }
      if (editing)
        return eduApi(`/api/admin/edu/exam/arrangements/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/edu/exam/arrangements`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'arrangements'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      eduApi(`/api/admin/edu/exam/arrangements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'arrangements'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(a: Arrangement) {
    setEditing(a)
    setForm(arrangementToForm(a))
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
    if (!form.paperId) return setErr(t('paperRequired'))
    saveMut.mutate()
  }
  function handleDelete(id: string) {
    if (window.confirm(t('deleteConfirm'))) deleteMut.mutate(id)
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
      <ArrangementsFilter onCreate={openCreate} />
      <ArrangementsTable
        rows={rows}
        isLoading={isLoading}
        error={error as Error | null}
        papers={papers}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletePending={deleteMut.isPending}
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('totalItems', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
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
          </Button>
        </div>
      </div>
      <ArrangementsDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        papers={papers}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
