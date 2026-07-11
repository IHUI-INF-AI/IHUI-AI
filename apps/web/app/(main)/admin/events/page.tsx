'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Activity, Plus, Edit, Trash2, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

type EventType = 'startup' | 'shutdown' | 'error' | 'warning' | 'maintenance' | 'deploy'
type Level = 'info' | 'warn' | 'error'

interface SystemEvent {
  id: string
  type: EventType
  level: Level
  message: string
  data?: Record<string, unknown> | null
  createdAt: string
}

const TYPES: EventType[] = ['startup', 'shutdown', 'error', 'warning', 'maintenance', 'deploy']
const LEVELS: Level[] = ['info', 'warn', 'error']
const LEVEL_BADGE: Record<Level, string> = {
  info: 'bg-muted text-muted-foreground',
  warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  error: 'bg-red-500/10 text-red-600 dark:text-red-500',
}
const TYPE_DOT: Record<EventType, string> = {
  startup: 'bg-emerald-500',
  shutdown: 'bg-muted-foreground',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  maintenance: 'bg-orange-500',
  deploy: 'bg-primary',
}
const EMPTY = { type: 'maintenance' as EventType, level: 'info' as Level, message: '', data: '' }
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
function normList(d: unknown): SystemEvent[] {
  return Array.isArray(d) ? (d as SystemEvent[]) : ((d as { list?: SystemEvent[] })?.list ?? [])
}

export default function AdminEventsPage() {
  const t = useTranslations('admin.events')
  const tc = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()
  const [type, setType] = React.useState<'all' | EventType>('all')
  const [level, setLevel] = React.useState<'all' | Level>('all')
  const [editing, setEditing] = React.useState<SystemEvent | null>(null)
  const [open, setOpen] = React.useState(false)
  const [delTarget, setDelTarget] = React.useState<SystemEvent | null>(null)
  const [form, setForm] = React.useState(EMPTY)
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
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(ev: SystemEvent) {
    setEditing(ev)
    setForm({
      type: ev.type,
      level: ev.level,
      message: ev.message,
      data: ev.data ? JSON.stringify(ev.data, null, 2) : '',
    })
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

  const dtFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

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

      <div className="flex flex-wrap items-center gap-2">
        <Select value={type} onValueChange={(v) => setType(v as 'all' | EventType)}>
          <SelectTrigger className={selectClass} aria-label={t('type')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTypes')}</SelectItem>
            {TYPES.map((tp) => (
              <SelectItem key={tp} value={tp}>
                {t(`types.${tp}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={(v) => setLevel(v as 'all' | Level)}>
          <SelectTrigger className={selectClass} aria-label={t('level')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allLevels')}</SelectItem>
            {LEVELS.map((lv) => (
              <SelectItem key={lv} value={lv}>
                {t(`levels.${lv}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">{t('noData')}</div>
        ) : (
          <ul className="divide-y">
            {list.map((ev) => (
              <li
                key={ev.id}
                className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TYPE_DOT[ev.type])} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {dtFmt.format(new Date(ev.createdAt))}
                    </span>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        LEVEL_BADGE[ev.level],
                      )}
                    >
                      {t(`levels.${ev.level}`)}
                    </span>
                    <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {t(`types.${ev.type}`)}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm">{ev.message}</p>
                  {ev.data && (
                    <pre className="mt-1.5 max-h-40 overflow-auto rounded-md bg-muted/50 p-2 text-xs">
                      {JSON.stringify(ev.data, null, 2)}
                    </pre>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(ev)}>
                    <Edit className="h-4 w-4" />
                    {tc('edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setErr(null)
                      setDelTarget(ev)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    {tc('delete')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
              <DialogDescription>{editing ? t('editDesc') : t('createDesc')}</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="e-type">{t('fieldType')}</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as EventType })}
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((tp) => (
                      <SelectItem key={tp} value={tp}>
                        {t(`types.${tp}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-level">{t('fieldLevel')}</Label>
                <Select
                  value={form.level}
                  onValueChange={(v) => setForm({ ...form, level: v as Level })}
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((lv) => (
                      <SelectItem key={lv} value={lv}>
                        {t(`levels.${lv}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-msg">{t('fieldMessage')}</Label>
              <textarea
                id="e-msg"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder={t('messagePlaceholder')}
                rows={3}
                className={textareaClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-meta">{t('fieldMetadata')}</Label>
              <textarea
                id="e-meta"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                placeholder={'{\n  \n}'}
                rows={4}
                className={cn(textareaClass, 'font-mono')}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
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
