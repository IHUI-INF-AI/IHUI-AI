'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Plus, ChevronLeft } from 'lucide-react'
import { eduApi, buildQs } from '@/lib/edu'
import { Button } from '@ihui/ui-react'

import { PapersTemplateTable } from './PapersTemplateTable'
import { PapersTemplateDialog } from './PapersTemplateDialog'
import { EMPTY_FORM, templateToForm } from './helpers'
import type { Template, PageData, TForm } from './types'

export default function EduExamPapersTemplatePage() {
  const t = useTranslations('admin.edu.exam.papersTemplate')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Template | null>(null)
  const [form, setForm] = React.useState<TForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exam', 'templates', page],
    queryFn: () =>
      eduApi<PageData<Template>>(`/api/admin/edu/exam/templates${buildQs({ page, pageSize: 10 })}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      let config: unknown = {}
      try {
        config = JSON.parse(form.config)
      } catch (e) {
        return Promise.reject(new Error(t('configJsonError', { message: (e as Error).message })))
      }
      const body = { name: form.name.trim(), description: form.description.trim() || null, config }
      if (editing)
        return eduApi(`/api/admin/edu/exam/templates/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/edu/exam/templates`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'templates'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/edu/exam/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'templates'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(tc: Template) {
    setEditing(tc)
    setForm(templateToForm(tc))
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
    if (!form.name.trim()) return setErr(t('nameRequired'))
    saveMut.mutate()
  }
  function handleDelete(tc: Template) {
    if (!window.confirm(t('confirmDelete'))) return
    deleteMut.mutate(tc.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 10))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/exam">
            <ChevronLeft className="h-4 w-4" />
            {t('backToExam')}
          </Link>
        </Button>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('createTemplate')}
        </Button>
      </div>

      <PapersTemplateTable
        list={rows}
        isLoading={isLoading}
        error={error}
        deletePending={deleteMut.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
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
          </Button>
        </div>
      </div>

      <PapersTemplateDialog
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
