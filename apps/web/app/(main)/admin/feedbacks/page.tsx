'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, MessageSquare, Edit } from 'lucide-react'

import { cn } from '@/lib/utils'
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
import {
  api as fbApi,
  TYPE_ICON,
  TYPE_BADGE,
  STATUS_BADGE,
  PRIORITY_BADGE,
  type FeedbackItem,
  type FeedbackType,
  type FeedbackStatus,
  type Priority,
} from '@/lib/feedback'

const TYPE_TABS: { value: string; labelKey: 'all' | FeedbackType }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'bug', labelKey: 'bug' },
  { value: 'feature', labelKey: 'feature' },
  { value: 'improvement', labelKey: 'improvement' },
  { value: 'other', labelKey: 'other' },
]
const STATUS_TABS: { value: string; labelKey: 'all' | FeedbackStatus }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'reviewing', labelKey: 'reviewing' },
  { value: 'resolved', labelKey: 'resolved' },
  { value: 'closed', labelKey: 'closed' },
]
const STATUS_OPTIONS: FeedbackStatus[] = ['pending', 'reviewing', 'resolved', 'closed']
const PRIORITY_OPTIONS: Priority[] = ['low', 'medium', 'high']
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminFeedbacksPage() {
  const t = useTranslations('admin.feedbacks')
  const tf = useTranslations('feedback')
  const tc = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const qc = useQueryClient()

  const [type, setType] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<FeedbackItem | null>(null)
  const [form, setForm] = React.useState({
    status: 'pending' as FeedbackStatus,
    priority: 'low' as Priority,
    adminReply: '',
  })
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'feedbacks', type, status],
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (type !== 'all') qs.set('type', type)
      if (status !== 'all') qs.set('status', status)
      const suffix = qs.toString() ? `?${qs.toString()}` : ''
      return fbApi<{ list: FeedbackItem[] }>(`/api/admin/feedbacks${suffix}`).then(
        (d) => d.list ?? [],
      )
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { status: form.status, priority: form.priority }
      if (form.adminReply.trim()) body.adminReply = form.adminReply.trim()
      return fetchApi(`/api/admin/feedbacks/${editing?.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'feedbacks'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })

  function openEdit(fb: FeedbackItem) {
    setEditing(fb)
    setForm({ status: fb.status, priority: fb.priority, adminReply: fb.adminReply ?? '' })
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
    saveMut.mutate()
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const list = data ?? []

  const renderTabs = (
    tabs: { value: string; labelKey: string }[],
    value: string,
    onChange: (v: string) => void,
    prefix: 'type' | 'status',
  ) => (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === tab.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tf(`${prefix}_${tab.labelKey}`)}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {renderTabs(TYPE_TABS, type, setType, 'type')}
        {renderTabs(STATUS_TABS, status, setStatus, 'status')}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('user')}</th>
              <th className="px-4 py-2.5 font-medium">{t('type')}</th>
              <th className="px-4 py-2.5 font-medium">{t('title_col')}</th>
              <th className="px-4 py-2.5 font-medium">{t('status')}</th>
              <th className="px-4 py-2.5 font-medium">{t('priority')}</th>
              <th className="px-4 py-2.5 font-medium">{t('createdAt')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              list.map((fb) => {
                const TypeIcon = TYPE_ICON[fb.type]
                return (
                  <tr
                    key={fb.id}
                    onClick={() => router.push(`/feedback/${fb.id}`)}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-medium">{fb.user ?? '-'}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          TYPE_BADGE[fb.type],
                        )}
                      >
                        <TypeIcon className="h-3 w-3" />
                        {tf(`type_${fb.type}`)}
                      </span>
                    </td>
                    <td className="max-w-xs break-words px-4 py-2.5">{fb.title}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          STATUS_BADGE[fb.status],
                        )}
                      >
                        {tf(`status_${fb.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          PRIORITY_BADGE[fb.priority],
                        )}
                      >
                        {tf(`priority_${fb.priority}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {dateFmt.format(new Date(fb.createdAt))}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(fb)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                        {t('edit')}
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('editTitle')}</DialogTitle>
              <DialogDescription>{t('editDesc')}</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            {editing && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <div className="font-medium">{editing.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {editing.user ?? '-'} · {tf(`type_${editing.type}`)}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fb-status">{tf('field_status')}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as FeedbackStatus })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {tf(`status_${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-priority">{tf('field_priority')}</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v as Priority })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {tf(`priority_${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-reply">{t('fieldReply')}</Label>
              <textarea
                id="fb-reply"
                value={form.adminReply}
                onChange={(e) => setForm({ ...form, adminReply: e.target.value })}
                placeholder={t('replyPlaceholder')}
                rows={4}
                className={textareaClass}
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
    </div>
  )
}
