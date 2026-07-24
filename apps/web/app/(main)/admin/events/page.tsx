'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Activity, Plus, Loader2 } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'

import { EventFilter } from './EventFilter'
import { EventTable } from './EventTable'
import { EventDialog } from './EventDialog'
import { api, normList, EMPTY_FORM, eventToForm, TYPE_DOT, LEVEL_BADGE } from './helpers'
import type { SystemEvent, EventForm, EventType, Level } from './types'

export default function AdminEventsPage() {
  const t = useTranslations('admin.events')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [type, setType] = React.useState<'all' | EventType>('all')
  const [level, setLevel] = React.useState<'all' | Level>('all')
  const [editing, setEditing] = React.useState<SystemEvent | null>(null)
  const [open, setOpen] = React.useState(false)
  const [delTarget, setDelTarget] = React.useState<SystemEvent | null>(null)
  const [form, setForm] = React.useState<EventForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'events', type, level],
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (type !== 'all') qs.set('type', type)
      if (level !== 'all') qs.set('level', level)
      const q = qs.toString()
      return normList(await api(`/api/admin/events${q ? `?${q}` : ''}`))
    },
  })

  function parseData(raw: string): unknown {
    if (!raw.trim()) return null
    try {
      return JSON.parse(raw)
    } catch {
      throw new Error(t('invalidMetadata'))
    }
  }

  const saveMut = useMutation({
    mutationFn: () => {
      const data = parseData(form.data)
      const body: Record<string, unknown> = {
        type: form.type,
        level: form.level,
        message: form.message,
        data,
      }
      return editing
        ? api(`/api/admin/events/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api('/api/admin/events', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'events'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'events'] })
      setDelTarget(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(ev: SystemEvent) {
    setEditing(ev)
    setForm(eventToForm(ev))
    setErr(null)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.message.trim()) {
      setErr(t('messageRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(ev: SystemEvent) {
    setErr(null)
    setDelTarget(ev)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Activity className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <EventFilter type={type} setType={setType} level={level} setLevel={setLevel} />

      <EventTable list={list} isLoading={isLoading} onEdit={openEdit} onDelete={handleDelete} />

      <EventDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />

      <Dialog
        open={!!delTarget}
        onOpenChange={(o) => (!o && !delMut.isPending ? setDelTarget(null) : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm')}</DialogDescription>
          </DialogHeader>
          {delTarget && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', TYPE_DOT[delTarget.type])} />
                <span className="font-medium">{t(`types.${delTarget.type}`)}</span>
                <span
                  className={cn(
                    'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                    LEVEL_BADGE[delTarget.level],
                  )}
                >
                  {t(`levels.${delTarget.level}`)}
                </span>
              </div>
              <p className="mt-1 break-words text-xs text-muted-foreground">{delTarget.message}</p>
            </div>
          )}
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDelTarget(null)}
              disabled={delMut.isPending}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => delMut.mutate(delTarget!.id)}
            >
              {delMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
