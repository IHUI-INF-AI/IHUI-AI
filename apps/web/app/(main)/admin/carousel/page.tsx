'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'

import { CarouselFilter } from './CarouselFilter'
import { CarouselTable } from './CarouselTable'
import { CarouselDialog } from './CarouselDialog'
import { PAGE_SIZE, api, EMPTY_FORM, EXPORT_COLUMNS, carouselToForm } from './helpers'
import type { Carousel, CarouselForm, ListData } from './types'

export default function CarouselPage() {
  const t = useTranslations('admin.carousel')
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Carousel | null>(null)
  const [form, setForm] = React.useState<CarouselForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'carousel', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('title', debounced)
      return api<ListData>(`/api/admin/carousel?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        imageUrl: form.imageUrl || undefined,
        linkUrl: form.linkUrl || undefined,
        sort: Number(form.sort) || 0,
        status: form.status ? 1 : 0,
      }
      return editing
        ? api(`/api/admin/carousel/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/carousel', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'carousel'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/carousel/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'carousel'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: Carousel) {
    setEditing(item)
    setForm(carouselToForm(item))
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
    if (!form.title.trim()) {
      setErr(t('titleRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: Carousel) {
    if (!window.confirm(t('deleteConfirm', { title: item.title }))) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      t('title'),
      EXPORT_COLUMNS,
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            {t('exportBtn')}
          </Button>
          <HasPermi code="ai:carousel:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('create')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <CarouselFilter search={search} setSearch={setSearch} />

      <CarouselTable list={list} isLoading={isLoading} onEdit={openEdit} onDelete={handleDelete} />

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
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
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

      <CarouselDialog
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
