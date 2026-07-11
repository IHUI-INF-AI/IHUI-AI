'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Plus, Workflow, Zap, Clock, Play } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

type TriggerType = 'manual' | 'schedule' | 'event' | 'webhook'
type WfStatus = 'active' | 'inactive'
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

const TRIGGER_BADGE: Record<TriggerType, string> = {
  manual: 'bg-muted text-muted-foreground',
  schedule: 'bg-amber-500/10 text-amber-600',
  event: 'bg-emerald-500/10 text-emerald-600',
  webhook: 'bg-primary/10 text-primary',
}
const STATUS_DOT: Record<WfStatus, string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-muted-foreground',
}

const DEFAULT_STEPS = `[
  { "name": "step1", "type": "task", "action": "echo" }
]`

export default function WorkflowsPage() {
  const t = useTranslations('workflows')
  const tc = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const qc = useQueryClient()

  const wfsQ = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api<{ list: WorkflowItem[] }>('/api/workflows').then((d) => d.list ?? []),
  })

  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState({
    name: '',
    description: '',
    triggerType: 'manual' as TriggerType,
    steps: DEFAULT_STEPS,
  })
  const [formErr, setFormErr] = React.useState<string | null>(null)

  const createMut = useMutation({
    mutationFn: () => {
      let steps: unknown
      try {
        steps = JSON.parse(form.steps)
      } catch {
        throw new Error(t('create.invalidSteps'))
      }
      return api('/api/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          triggerType: form.triggerType,
          steps,
        }),
      })
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['workflows'] })
      setCreateOpen(false)
      setForm({ name: '', description: '', triggerType: 'manual', steps: DEFAULT_STEPS })
      setFormErr(null)
      const created = d as { id?: string }
      if (created?.id) router.push(`/workflows/${created.id}`)
    },
    onError: (e: Error) => setFormErr(e.message),
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr(null)
    if (!form.name.trim()) {
      setFormErr(t('create.nameRequired'))
      return
    }
    createMut.mutate()
  }

  const wfs = wfsQ.data ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

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
        <Dialog
          open={createOpen}
          onOpenChange={(o) => {
            if (!o && createMut.isPending) return
            setCreateOpen(o)
            if (!o) {
              setForm({ name: '', description: '', triggerType: 'manual', steps: DEFAULT_STEPS })
              setFormErr(null)
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {t('create.title')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <form onSubmit={handleCreate} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t('create.title')}</DialogTitle>
                <DialogDescription>{t('create.desc')}</DialogDescription>
              </DialogHeader>
              {formErr && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formErr}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="wf-name">{t('create.name')}</Label>
                <Input
                  id="wf-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t('create.namePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wf-desc">{t('create.description')}</Label>
                <textarea
                  id="wf-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wf-trigger">{t('create.triggerType')}</Label>
                <Select
                  value={form.triggerType}
                  onValueChange={(v) => setForm({ ...form, triggerType: v as TriggerType })}
                >
                  <SelectTrigger className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">{t('triggers.manual')}</SelectItem>
                    <SelectItem value="schedule">{t('triggers.schedule')}</SelectItem>
                    <SelectItem value="event">{t('triggers.event')}</SelectItem>
                    <SelectItem value="webhook">{t('triggers.webhook')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wf-steps">{t('create.steps')}</Label>
                <textarea
                  id="wf-steps"
                  value={form.steps}
                  onChange={(e) => setForm({ ...form, steps: e.target.value })}
                  rows={6}
                  spellCheck={false}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={createMut.isPending}
                >
                  {tc('cancel')}
                </Button>
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('create.submit')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {wfsQ.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : wfs.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          {t('noData')}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wfs.map((w) => {
            const stepCount = Array.isArray(w.steps) ? w.steps.length : 0
            const status: WfStatus = w.isActive ? 'active' : 'inactive'
            return (
              <Card
                key={w.id}
                className="cursor-pointer transition-colors hover:bg-accent/40"
                onClick={() => router.push(`/workflows/${w.id}`)}
              >
                <CardHeader className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Workflow className="h-5 w-5" />
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                        TRIGGER_BADGE[w.triggerType],
                      )}
                    >
                      <Zap className="h-3 w-3" />
                      {t(`triggers.${w.triggerType}`)}
                    </span>
                  </div>
                  <CardTitle className="text-base">{w.name}</CardTitle>
                  <CardDescription className="text-xs">{w.description || '-'}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    {t('stepsCount', { count: stepCount })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
                    {t(`status.${status}`)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {dateFmt.format(new Date(w.createdAt))}
                  </span>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
