'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, Plus, Download } from 'lucide-react'
import { toast } from 'sonner'
import { exportFromApi } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'

import { AboutUsFilter } from './AboutUsFilter'
import { AboutUsTable } from './AboutUsTable'
import { AboutUsDialog } from './AboutUsDialog'
import { RESOURCE, PERM, PAGE_SIZE, EMPTY, SEARCH_KEYS, FIELDS, COLS, api } from './helpers'
import type { AboutUsItem, AboutUsList } from './types'

export default function AboutUsPage() {
  const t = useTranslations('admin.aboutUs')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AboutUsItem | null>(null)
  const [form, setForm] = React.useState<AboutUsItem>(EMPTY)
  const [search, setSearch] = React.useState<Record<string, string>>({
    network: '',
    phone: '',
    socialMedia: '',
    experience: '',
  })
  const [page, setPage] = React.useState(1)

  const params = React.useMemo(() => {
    const p: Record<string, string> = { page: String(page), pageSize: String(PAGE_SIZE) }
    SEARCH_KEYS.forEach((k) => {
      const v = search[k]?.trim()
      if (v) p[k] = v
    })
    return p
  }, [search, page])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'about-us', params],
    queryFn: () => api<AboutUsList>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = JSON.stringify(Object.fromEntries(FIELDS.map((f) => [f.key, form[f.key]])))
      return editing?.id
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body })
        : api(RESOURCE, { method: 'POST', body })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'about-us'] })
      close()
    },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'about-us'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: AboutUsItem) {
    setEditing(item)
    setForm(item)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    saveMut.mutate()
  }
  function handleReset() {
    setSearch({ network: '', phone: '', socialMedia: '', experience: '' })
    setPage(1)
  }
  async function handleExport() {
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      t('title'),
      COLS.map((c) => ({ key: c.key, title: t(c.label) })),
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
            <Info className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pageDescription')}</p>
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

      <AboutUsFilter
        search={search}
        setSearch={setSearch}
        onSearch={() => setPage(1)}
        onReset={handleReset}
      />

      <AboutUsTable
        list={list}
        isLoading={isLoading}
        deletePending={delMut.isPending}
        onEdit={openEdit}
        onDelete={(id) => delMut.mutate(id)}
      />

      {total > PAGE_SIZE && (
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
              disabled={page * PAGE_SIZE >= total}
              onClick={() => setPage(page + 1)}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              {t('nextPage')}
            </button>
          </div>
        </div>
      )}

      <AboutUsDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />
    </div>
  )
}
