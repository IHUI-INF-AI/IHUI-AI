'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { LiveCategoryFilter } from './LiveCategoryFilter'
import { LiveCategoryTable } from './LiveCategoryTable'
import { LiveCategoryDialog } from './LiveCategoryDialog'
import { api, EMPTY_FORM, categoryToForm } from './helpers'
import type { Category, CategoryForm, ListData } from './types'

export default function AdminLiveCategoriesPage() {
  const t = useTranslations('admin.live')
  const qc = useQueryClient()

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Category | null>(null)
  const [form, setForm] = React.useState<CategoryForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'live', 'categories', 'all'],
    queryFn: () => api<ListData>(`/api/admin/live/categories`).then((d) => d.list ?? []),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        sort: Number(form.sort) || 0,
        status: form.status ? 1 : 0,
      }
      return editing
        ? api<{ category: Category }>(`/api/admin/live/categories/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api<{ category: Category }>(`/api/admin/live/categories`, {
            method: 'POST',
            body: JSON.stringify(body),
          })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'live', 'categories'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/live/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'live', 'categories'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(cat: Category) {
    setEditing(cat)
    setForm(categoryToForm(cat))
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
    if (!form.name.trim()) {
      setErr(t('nameRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(cat: Category) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(cat.id)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('categoriesTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('categoriesSubtitle')}</p>
      </div>

      <LiveCategoryFilter onCreate={openCreate} />

      <LiveCategoryTable
        list={data ?? []}
        isLoading={isLoading}
        error={error as Error | null}
        deletePending={deleteMut.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <LiveCategoryDialog
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
