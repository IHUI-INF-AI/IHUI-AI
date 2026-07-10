'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  CalendarClock,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Clock,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'

interface OfflineRecord {
  id: string
  type: string
  title: string
  description: string | null
  hours: number | null
  occurredAt: string | null
}

interface RecordForm {
  type: string
  title: string
  description: string
  hours: string
  occurredAt: string
}

const EMPTY_FORM: RecordForm = {
  type: '',
  title: '',
  description: '',
  hours: '',
  occurredAt: '',
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function OfflineRecordsPage() {
  const t = useTranslations('offlineRecords')
  const tc = useTranslations('student')
  const qc = useQueryClient()

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OfflineRecord | null>(null)
  const [form, setForm] = React.useState<RecordForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading, error } = useQuery({
    queryKey: ['student', 'offline-records'],
    queryFn: () =>
      api<OfflineRecord[] | { list: OfflineRecord[] }>(
        '/api/edu/my-offline-records',
      ).then((d) => (Array.isArray(d) ? d : d.list ?? [])),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        type: form.type.trim(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        hours: form.hours ? Number(form.hours) : undefined,
        occurredAt: form.occurredAt || undefined,
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
    setForm({
      type: record.type,
      title: record.title,
      description: record.description ?? '',
      hours: record.hours !== null && record.hours !== undefined ? String(record.hours) : '',
      occurredAt: record.occurredAt ? record.occurredAt.slice(0, 10) : '',
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

  const TYPE_COLORS = [
    'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  ]

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

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <CalendarClock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((record, idx) => (
            <Card key={record.id} className="transition-colors hover:border-primary/40">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        TYPE_COLORS[idx % TYPE_COLORS.length],
                      )}
                    >
                      {record.type}
                    </span>
                    {record.hours !== null && record.hours !== undefined && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {record.hours}h
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(record)}>
                      <Edit className="h-4 w-4" />
                      {t('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={delMut.isPending}
                      onClick={() => handleDelete(record)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('delete')}
                    </Button>
                  </div>
                </div>
                <h3 className="font-medium">{record.title}</h3>
                {record.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {record.description}
                  </p>
                )}
                {record.occurredAt && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(record.occurredAt).toLocaleDateString('zh-CN')}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('edit') : t('create')}</DialogTitle>
              <DialogDescription>{t('subtitle')}</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="r-type">{t('type')}</Label>
              <Input
                id="r-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                placeholder={t('typePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-title">{t('titleField')}</Label>
              <Input
                id="r-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-desc">{t('descriptionField')}</Label>
              <textarea
                id="r-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="r-hours">{t('hoursField')}</Label>
                <Input
                  id="r-hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-date">{t('occurredAtField')}</Label>
                <Input
                  id="r-date"
                  type="date"
                  value={form.occurredAt}
                  onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
