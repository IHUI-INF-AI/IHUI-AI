'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ihui/ui'

import { CirclesFilter } from './CirclesFilter'
import { CirclesTable } from './CirclesTable'
import { CircleDialog } from './CircleDialog'
import { EMPTY_FORM, PAGE_SIZE, api, circleToForm, fetchCircles, slugify } from './helpers'
import type { Circle, CircleForm } from './types'

export default function AdminCirclesPage() {
  const t = useTranslations('admin.circles')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Circle | null>(null)
  const [form, setForm] = React.useState<CircleForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'circles', debounced, page],
    queryFn: () => fetchCircles({ page, search: debounced }),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        description: form.description.trim() || null,
        coverImage: form.coverImage.trim() || null,
        isPublished: form.isPublished,
      }
      return editing
        ? api(`/api/admin/circles/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/circles', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'circles'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: (item: Circle) =>
      api(`/api/admin/circles/${item.id}/show`, {
        method: 'PUT',
        body: JSON.stringify({ isPublished: !item.isPublished }),
      }),
    onSuccess: () => {
      toast.success(t('toggleSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'circles'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/circles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'circles'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: Circle) {
    setEditing(item)
    setForm(circleToForm(item))
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
    if (!form.slug.trim() && !form.name.trim()) return setErr(t('slugRequired'))
    saveMut.mutate()
  }
  function handleToggle(item: Circle) {
    if (window.confirm(t('toggleConfirm'))) toggleMut.mutate(item)
  }
  function handleDelete(item: Circle) {
    if (window.confirm(t('deleteConfirm'))) deleteMut.mutate(item.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const list = data?.list ?? []
  const mockMode = !!error && list.length === 0

  return (
    <div className="space-y-4">
      <CirclesFilter
        search={search}
        setSearch={setSearch}
        onCreate={openCreate}
        mockMode={mockMode}
      />
      <CirclesTable
        list={list}
        isLoading={isLoading}
        togglePending={toggleMut.isPending}
        deletePending={deleteMut.isPending}
        onEdit={openEdit}
        onToggle={handleToggle}
        onDelete={handleDelete}
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
      <CircleDialog
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
