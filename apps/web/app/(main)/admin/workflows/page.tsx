'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Workflow, Zap, Plus, Edit, Trash2, Eye } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
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

type TriggerType = 'manual' | 'schedule' | 'event' | 'webhook'
type WfStatus = 'active' | 'draft' | 'archived'

interface WorkflowItem {
  id: string
  name: string
  description?: string
  triggerType: TriggerType
  steps?: unknown[]
  isActive: boolean
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

async function fetchWorkflows(): Promise<WorkflowItem[]> {
  const data = await api<{ list: WorkflowItem[] }>('/api/workflows')
  return data?.list ?? []
}

const STATUS_BADGE: Record<WfStatus, { cls: string; dot: string }> = {
  active: {
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
    dot: 'bg-emerald-500',
  },
  draft: { cls: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  archived: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500', dot: 'bg-amber-500' },
}

const TRIGGER_BADGE: Record<TriggerType, string> = {
  manual: 'bg-muted text-muted-foreground',
  schedule: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  event: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  webhook: 'bg-primary/10 text-primary',
}

const TRIGGER_OPTIONS: TriggerType[] = ['manual', 'schedule', 'event', 'webhook']
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass =
  'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const EMPTY = { name: '', description: '', triggerType: 'manual' as TriggerType, stepsText: '' }

export default function AdminWorkflowsPage() {
  const t = useTranslations('admin.workflows')
  const tc = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<WorkflowItem | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)
  const [delId, setDelId] = React.useState<string | null>(null)
  const [viewItem, setViewItem] = React.useState<WorkflowItem | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'workflows'],
    queryFn: fetchWorkflows,
  })

  const workflows = data ?? []
  const total = workflows.length
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const steps = form.stepsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name }))
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        triggerType: form.triggerType,
        steps,
      }
      return editing
        ? api(`/api/workflows/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api('/api/workflows', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'workflows'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/workflows/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'workflows'] })
      setDelId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(w: WorkflowItem) {
    setEditing(w)
    const steps = Array.isArray(w.steps)
      ? w.steps
          .map((s) =>
            typeof s === 'object' && s !== null && 'name' in s
              ? String((s as { name: unknown }).name)
              : JSON.stringify(s),
          )
          .join('\n')
      : ''
    setForm({
      name: w.name,
      description: w.description ?? '',
      triggerType: w.triggerType,
      stepsText: steps,
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
    if (!form.name.trim()) {
      setErr(t('nameRequired'))
      return
    }
    const stepCount = form.stepsText.split('\n').filter((s) => s.trim()).length
    if (stepCount === 0) {
      setErr(t('stepsRequired'))
      return
    }
    saveMut.mutate()
  }

  const th = 'px-4 py-2.5 font-medium'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Workflow className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('name')}</th>
              <th className={th}>{t('triggerType')}</th>
              <th className={th}>{t('status')}</th>
              <th className={th}>{t('createdAt')}</th>
              <th className={cn(th, 'text-right')}>{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : workflows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Workflow className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              workflows.map((w) => {
                const status: WfStatus = w.isActive ? 'active' : 'archived'
                const sc = STATUS_BADGE[status] ?? STATUS_BADGE.draft
                const stepCount = Array.isArray(w.steps) ? w.steps.length : 0
                return (
                  <tr key={w.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Workflow className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium">{w.name}</div>
                          {w.description ? (
                            <div className="text-xs text-muted-foreground">{w.description}</div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                          TRIGGER_BADGE[w.triggerType] ?? TRIGGER_BADGE.manual,
                        )}
                      >
                        <Zap className="h-3 w-3" />
                        {t(`trigger_${w.triggerType}`)}
                      </span>
                      {stepCount > 0 ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t('stepsCount', { count: stepCount })}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          sc.cls,
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                        {t(`status_${status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {dateFmt.format(new Date(w.createdAt))}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewItem(w)}>
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          {t('view')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(w)}>
                          <Edit className="mr-1 h-3.5 w-3.5" />
                          {tc('edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDelId(w.id)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          {tc('delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-muted-foreground">{t('total', { total })}</div>

      {/* 创建/编辑对话框 */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) close()
          else setOpen(true)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            <DialogDescription>{editing ? t('editDesc') : t('createDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wf-name">{t('name')}</Label>
              <Input
                id="wf-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('namePlaceholder')}
                maxLength={128}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wf-desc">{t('description')}</Label>
              <Input
                id="wf-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t('descPlaceholder')}
                maxLength={2000}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wf-trigger">{t('triggerType')}</Label>
              <Select
                value={form.triggerType}
                onValueChange={(v) => setForm((f) => ({ ...f, triggerType: v as TriggerType }))}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map((tt) => (
                    <SelectItem key={tt} value={tt}>
                      {t(`trigger_${tt}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wf-steps">{t('steps')}</Label>
              <textarea
                id="wf-steps"
                className={cn(textareaClass, 'min-h-[100px] font-mono')}
                value={form.stepsText}
                onChange={(e) => setForm((f) => ({ ...f, stepsText: e.target.value }))}
                placeholder={t('stepsPlaceholder')}
                rows={4}
              />
            </div>
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                {editing ? tc('save') : t('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 查看详情对话框 */}
      <Dialog
        open={viewItem !== null}
        onOpenChange={(v) => {
          if (!v) setViewItem(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('viewTitle')}</DialogTitle>
          </DialogHeader>
          {viewItem ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Workflow className="h-4 w-4" />
                </div>
                <span className="font-medium">{viewItem.name}</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                    (STATUS_BADGE[viewItem.isActive ? 'active' : 'archived'] ?? STATUS_BADGE.draft)
                      .cls,
                  )}
                >
                  {t(`status_${viewItem.isActive ? 'active' : 'archived'}`)}
                </span>
              </div>
              {viewItem.description ? (
                <p className="text-muted-foreground">{viewItem.description}</p>
              ) : null}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="h-3 w-3" />
                {t(`trigger_${viewItem.triggerType}`)}
                <span className="mx-1">·</span>
                {dateFmt.format(new Date(viewItem.createdAt))}
              </div>
              {Array.isArray(viewItem.steps) && viewItem.steps.length > 0 ? (
                <div className="rounded-md border p-3">
                  <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                    {t('steps')}
                  </div>
                  <ol className="ml-4 list-decimal space-y-1">
                    {viewItem.steps.map((s, i) => {
                      const name =
                        typeof s === 'object' && s !== null && 'name' in s
                          ? String((s as { name: unknown }).name)
                          : JSON.stringify(s)
                      return (
                        <li key={`step-${i}`} className="text-sm">
                          {name}
                        </li>
                      )
                    })}
                  </ol>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewItem(null)}>
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={delId !== null}
        onOpenChange={(v) => {
          if (!v) setDelId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDelId(null)}
              disabled={delMut.isPending}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => {
                if (delId) delMut.mutate(delId)
              }}
            >
              {delMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
