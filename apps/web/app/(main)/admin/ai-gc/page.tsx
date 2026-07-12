'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Plus } from 'lucide-react'
import { Button } from '@ihui/ui'

import { AiGcTable } from './AiGcTable'
import { AiGcDialog } from './AiGcDialog'
import { PAGE_SIZE, api, EMPTY } from './helpers'
import type { AiGcItem, AiGcList } from './types'

export default function AiGcPage() {
  const t = useTranslations('admin.aiGc')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AiGcItem | null>(null)
  const [form, setForm] = React.useState<AiGcItem>(EMPTY)
  const [page, setPage] = React.useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ai-gc', page],
    queryFn: () => api<AiGcList>(`/api/admin/ai-gc?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title,
        subtitle: form.subtitle,
        context: form.context,
        fileUrl: form.fileUrl,
        fileType: form.fileType,
        coverUrl: form.coverUrl,
        type: form.type,
        creator: form.creator,
      }
      return editing?.id
        ? api(`/api/admin/ai-gc/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/ai-gc', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'ai-gc'] })
      close()
    },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/ai-gc/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai-gc'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: AiGcItem) {
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
    if (!form.title.trim()) return
    saveMut.mutate()
  }
  function handleDelete(id: string) {
    if (window.confirm(t('deleteConfirm'))) delMut.mutate(id)
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" />
            {t('pageHeader')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <AiGcTable
        list={list}
        isLoading={isLoading}
        delPending={delMut.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
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
              {t('prev')}
            </button>
            <button
              disabled={page * PAGE_SIZE >= total}
              onClick={() => setPage(page + 1)}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}

      <AiGcDialog
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
