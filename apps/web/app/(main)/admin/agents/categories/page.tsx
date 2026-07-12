'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Tag } from 'lucide-react'

import { Button } from '@ihui/ui'
import { CategoryFilter } from './CategoryFilter'
import { CategoryTable } from './CategoryTable'
import { CategoryDialog } from './CategoryDialog'
import { PAGE_SIZE, EMPTY_FORM, api, fetchCategories, formFromCategory } from './helpers'
import type { Category, CategoryForm } from './types'

export default function AdminCategoriesPage() {
  const t = useTranslations('admin.agents.categories')
  const tc = useTranslations('common')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Category | null>(null)
  const [form, setForm] = React.useState<CategoryForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'agents', 'categories', debounced, page],
    queryFn: () => fetchCategories({ page, keyword: debounced }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        icon: form.icon.trim() || undefined,
        sort: Number(form.sort) || 0,
        status: form.status ? '1' : '0',
        isPaid: form.isPaid,
      }
      if (editing) {
        return api<Category>(`/api/categories/${editing.categoryId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<Category>('/api/categories/create', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agents', 'categories'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const togglePaidMut = useMutation({
    mutationFn: (p: { cat: Category; enable: boolean }) =>
      api<Category>(`/api/categories/${p.cat.categoryId}/${p.enable ? 'enable' : 'disable'}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'agents', 'categories'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agents', 'categories'] })
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
    setForm(formFromCategory(cat))
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

  const categories = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Tag className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {tc('create')}
        </Button>
      </div>

      <CategoryFilter value={search} onChange={setSearch} />

      <CategoryTable
        list={categories}
        isLoading={isLoading}
        error={error as Error | null}
        togglePaidPending={togglePaidMut.isPending}
        deletePending={deleteMut.isPending}
        onEdit={openEdit}
        onDelete={(cat) => deleteMut.mutate(cat.categoryId)}
        onTogglePaid={(cat, enable) => togglePaidMut.mutate({ cat, enable })}
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
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
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

      <CategoryDialog
        open={open}
        editing={!!editing}
        form={form}
        err={err}
        isPending={saveMut.isPending}
        onFormChange={setForm}
        onClose={closeDialog}
        onSubmit={submit}
      />
    </div>
  )
}
