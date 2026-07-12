'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { exportFromApi } from '@/lib/export-utils'
import { Button } from '@ihui/ui'

import { EMPTY, PAGE_SIZE, API, EXPORT_COLS } from './helpers'
import type { Category, CForm } from './types'
import { CategoryFilter } from './CategoryFilter'
import { CategoryTable } from './CategoryTable'
import { CategoryDialog } from './CategoryDialog'

export default function EduCourseCategoriesPage() {
  const t = useTranslations('admin.edu.course.categories')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState({ code: '', name: '', prentId: '' })
  const [ids, setIds] = React.useState<string[]>([])
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Category | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'category-dictionary', params],
    queryFn: () => eduApi<PageData<Category>>(`${API}${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        prentId: form.prentId.trim() || null,
        typeId: form.typeId.trim() || null,
        img: form.img || null,
        butImg: form.butImg || null,
        isInvalid: Number(form.isInvalid),
        sort: Number(form.sort) || 0,
      }
      return editing
        ? eduApi(`${API}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : eduApi(API, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'category-dictionary'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`${API}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'category-dictionary'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const batchDeleteMut = useMutation({
    mutationFn: (ids: string[]) => eduApi(`${API}/${ids.join(',')}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('batchDeleteSuccess'))
      setIds([])
      qc.invalidateQueries({ queryKey: ['edu', 'category-dictionary'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: Category) {
    setEditing(r)
    setForm({
      code: r.code ?? '',
      name: r.name ?? '',
      prentId: r.prentId ?? '',
      typeId: r.typeId ?? '',
      img: r.img ?? '',
      butImg: r.butImg ?? '',
      isInvalid: String(r.isInvalid ?? 0),
      sort: String(r.sort ?? 0),
    })
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
    if (!form.code.trim()) return setErr(t('codeRequired'))
    if (!form.typeId.trim()) return setErr(t('typeIdRequired'))
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(
      `${API}${buildQs({ ...q, pageSize: 10000 })}`,
      `categoryDictionary_${Date.now()}`,
      EXPORT_COLS,
      t,
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? t('exportSuccess') : t('exportFailed')))
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const allChecked = rows.length > 0 && rows.every((r) => ids.includes(r.id))
  function toggleAll() {
    setIds(allChecked ? [] : rows.map((r) => r.id))
  }
  function toggleOne(id: string) {
    setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <CategoryFilter
        q={q}
        onQChange={(patch) => {
          setQ({ ...q, ...patch })
          setPage(1)
        }}
        onReset={() => {
          setQ({ code: '', name: '', prentId: '' })
          setPage(1)
        }}
        onCreate={openCreate}
        onBatchDelete={() => {
          if (window.confirm(t('confirmBatchDelete', { count: ids.length })))
            batchDeleteMut.mutate(ids)
        }}
        onExport={handleExport}
        hasSelection={ids.length > 0}
      />
      <CategoryTable
        rows={rows}
        isLoading={isLoading}
        error={error as Error | null}
        ids={ids}
        allChecked={allChecked}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onEdit={openEdit}
        onDelete={(r) => {
          if (window.confirm(t('confirmDelete'))) deleteMut.mutate(r.id)
        }}
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
      <CategoryDialog
        open={open}
        editing={editing}
        form={form}
        onFormChange={(patch) => setForm({ ...form, ...patch })}
        onClose={closeDialog}
        onSubmit={submit}
        pending={saveMut.isPending}
        err={err}
      />
    </div>
  )
}
