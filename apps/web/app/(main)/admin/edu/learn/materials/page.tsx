'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { isNotFound } from '@/lib/api-error'
import { Button } from '@ihui/ui-react'

import { MaterialsFilter } from './MaterialsFilter'
import { MaterialsTable } from './MaterialsTable'
import { MaterialsDialog } from './MaterialsDialog'
import { PAGE_SIZE, EMPTY, materialToForm } from './helpers'
import type { Material, MForm } from './types'

export default function EduLearnMaterialsPage() {
  const t = useTranslations('admin.edu.learn.materials')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [typeFilter, setTypeFilter] = React.useState('all')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Material | null>(null)
  const [form, setForm] = React.useState<MForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    setPage(1)
  }, [typeFilter])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'learn', 'materials', page, typeFilter],
    queryFn: () =>
      eduApi<PageData<Material>>(
        `/api/admin/learn/materials${buildQs({ page, pageSize: PAGE_SIZE, type: typeFilter === 'all' ? '' : typeFilter })}`,
      ),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        type: form.type,
        fileUrl: form.fileUrl.trim() || null,
        lessonId: form.lessonId || null,
      }
      if (editing)
        return eduApi(`/api/admin/learn/materials/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/learn/materials`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'learn', 'materials'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/learn/materials/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'learn', 'materials'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(m: Material) {
    setEditing(m)
    setForm(materialToForm(m))
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
    saveMut.mutate()
  }
  function handleDelete(id: string) {
    if (window.confirm(t('deleteConfirm'))) deleteMut.mutate(id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const noEndpoint = isNotFound(error)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <MaterialsFilter typeFilter={typeFilter} onTypeChange={setTypeFilter} onCreate={openCreate} />
      <MaterialsTable
        rows={rows}
        isLoading={isLoading}
        noEndpoint={noEndpoint}
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
      <MaterialsDialog
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
