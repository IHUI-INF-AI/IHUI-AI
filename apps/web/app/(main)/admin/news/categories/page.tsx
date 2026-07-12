'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { NewsCategoryFilter } from './NewsCategoryFilter'
import { NewsCategoryTable } from './NewsCategoryTable'
import { NewsCategoryDialog } from './NewsCategoryDialog'
import { api, EMPTY_FORM, categoryToForm } from './helpers'
import type { Category, CategoryForm } from './types'

export default function AdminNewsCategoriesPage() {
  const t = useTranslations('admin.news')
  const qc = useQueryClient()

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Category | null>(null)
  const [form, setForm] = React.useState<CategoryForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'news', 'categories', 'all'],
    queryFn: () =>
      api<{ list: Category[] }>(`/api/admin/news/categories`).then((d) => d.list ?? []),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        sort: Number(form.sort) || 0,
        status: form.status ? 1 : 0,
      }
      if (editing) {
        return api<{ category: Category }>(`/api/admin/news/categories/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ category: Category }>(`/api/admin/news/categories`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'news', 'categories'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/news/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'news', 'categories'] })
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

  const categories = data ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('categoriesTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('categoriesSubtitle')}</p>
      </div>

      <NewsCategoryFilter onCreate={openCreate} />

      <NewsCategoryTable
        list={categories}
        isLoading={isLoading}
        error={error as Error | null}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletePending={deleteMut.isPending}
      />

      <NewsCategoryDialog
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
