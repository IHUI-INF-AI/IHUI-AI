'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Plus, ChevronLeft } from 'lucide-react'
import { eduApi } from '@/lib/edu'
import { Button } from '@ihui/ui'

import { CategoriesTable } from './CategoriesTable'
import { CategoriesDialog } from './CategoriesDialog'
import { EMPTY } from './helpers'
import type { Category } from './types'

export default function EduExamCategoriesPage() {
  const t = useTranslations('admin.edu.exam.categories')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Category | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exam', 'categories'],
    queryFn: () =>
      eduApi<{ list: Category[] }>(`/api/admin/exam/categories`).then((d) => d.list ?? []),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        sort: Number(form.sort) || 0,
        status: form.status ? 1 : 0,
      }
      if (editing)
        return eduApi(`/api/admin/exam/categories/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/exam/categories`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'categories'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/exam/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'categories'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(c: Category) {
    setEditing(c)
    setForm({ name: c.name, sort: String(c.sort), status: c.status === 1 })
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

  const categories = data ?? []
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/exam">
            <ChevronLeft className="h-4 w-4" />
            {t('backToExam')}
          </Link>
        </Button>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('createCategory')}
        </Button>
      </div>
      <CategoriesTable
        categories={categories}
        isLoading={isLoading}
        error={error}
        deletePending={deleteMut.isPending}
        onEdit={openEdit}
        onDelete={deleteMut.mutate}
      />
      <CategoriesDialog
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
