'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { CalendarClock, Plus } from 'lucide-react'

import { Button } from '@ihui/ui-react'

import { OfflineRecordList } from './OfflineRecordList'
import { OfflineRecordDialog } from './OfflineRecordDialog'
import { EMPTY_FORM, api, recordToForm } from './helpers'
import type { OfflineRecord, RecordForm } from './types'

export default function OfflineRecordsPage() {
  const t = useTranslations('offlineRecords')
  const qc = useQueryClient()

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OfflineRecord | null>(null)
  const [form, setForm] = React.useState<RecordForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const {
    data: list = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['student', 'offline-records'],
    queryFn: () =>
      api<OfflineRecord[] | { list: OfflineRecord[] }>('/api/edu/my-offline-records').then((d) =>
        Array.isArray(d) ? d : (d.list ?? []),
      ),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        type: form.type.trim(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        hours: form.hours ? Number(form.hours) : undefined,
        occurredAt: form.occurredAt || undefined,
        attachments: form.attachments,
      }
      if (editing) {
        return api(`/api/edu/offline-records/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api('/api/edu/offline-records', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', 'offline-records'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/edu/offline-records/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student', 'offline-records'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(record: OfflineRecord) {
    setEditing(record)
    setForm(recordToForm(record))
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
      setErr(t('titleField'))
      return
    }
    if (!form.type.trim()) {
      setErr(t('type'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(record: OfflineRecord) {
    if (!window.confirm(t('deleteConfirm'))) return
    delMut.mutate(record.id)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <CalendarClock className="h-7 w-7 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </header>

      <OfflineRecordList
        list={list}
        isLoading={isLoading}
        error={error as Error | null}
        delPending={delMut.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <OfflineRecordDialog
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
