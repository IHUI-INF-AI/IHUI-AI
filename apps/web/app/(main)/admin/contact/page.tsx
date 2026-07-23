'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Phone, Plus, Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { exportFromApi, type ExportColumn } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'

import { ContactFilter } from './ContactFilter'
import { ContactTable } from './ContactTable'
import { ContactDialog } from './ContactDialog'
import { RESOURCE, PERM, EMPTY, FIELDS, api } from './helpers'
import type { ContactItem, ContactList } from './types'

export default function ContactPage() {
  const t = useTranslations('adminContact')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ContactItem | null>(null)
  const [form, setForm] = React.useState<ContactItem>(EMPTY)
  const [search, setSearch] = React.useState<Record<string, string>>({
    introduction: '',
    corporateCulture: '',
  })
  const [page, setPage] = React.useState(1)
  const pageSize = 10

  const params = React.useMemo(() => {
    const p: Record<string, string> = { page: String(page), pageSize: String(pageSize) }
    FIELDS.forEach((f) => {
      const v = (search[f.key] || '').trim()
      if (v) p[f.key] = v
    })
    return p
  }, [search, page])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'contact', params],
    queryFn: () => api<ContactList>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({
        introduction: form.introduction,
        corporateCulture: form.corporateCulture,
      })
      return editing?.id
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body })
        : api(RESOURCE, { method: 'POST', body })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'contact'] })
      closeDialog()
    },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'contact'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: ContactItem) {
    setEditing(item)
    setForm(item)
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    saveMut.mutate()
  }
  function handleReset() {
    setSearch({ introduction: '', corporateCulture: '' })
    setPage(1)
  }
  async function handleExport() {
    const EXPORT_COLS: ExportColumn[] = [
      { key: 'id', title: 'ID' },
      ...FIELDS.map((f) => ({ key: f.key, title: t(f.label) })),
    ]
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      t('exportName'),
      EXPORT_COLS,
    )
    if (!ok) toast.error(t('exportFailed'))
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Phone className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <HasPermi code={`${PERM}:export`}>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              {t('export')}
            </Button>
          </HasPermi>
          <HasPermi code={`${PERM}:add`}>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('add')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <ContactFilter
        search={search}
        setSearch={setSearch}
        onSearch={() => setPage(1)}
        onReset={handleReset}
      />

      <ContactTable
        list={list}
        isLoading={isLoading}
        delPending={delMut.isPending}
        onEdit={openEdit}
        onDelete={(id) => delMut.mutate(id)}
      />

      {total > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('total', { total })}</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              {t('prevPage')}
            </button>
            <button
              disabled={page * pageSize >= total}
              onClick={() => setPage(page + 1)}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              {t('nextPage')}
            </button>
          </div>
        </div>
      )}

      <ContactDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
