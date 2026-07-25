'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, ArrowLeft, Play, Square, RotateCcw, Workflow, Zap } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

type TriggerType = 'manual' | 'schedule' | 'event' | 'webhook'
type InstStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
interface Workflow {
  id: string
  name: string
  description?: string
  triggerType: TriggerType
  steps?: unknown[]
  status: string
  createdAt: string
}
interface Instance {
  id: string
  status: InstStatus
  startedAt?: string
  completedAt?: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_BADGE: Record<InstStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  cancelled: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
}

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('workflows')
  const locale = useLocale()
  const qc = useQueryClient()

  const wfQ = useQuery({
    queryKey: ['workflows', id],
    queryFn: () => api<{ workflow: Workflow }>(`/api/workflows/${id}`).then((d) => d.workflow),
  })
  const instQ = useQuery({
    queryKey: ['workflows', id, 'instances'],
    queryFn: () =>
      api<{ list: Instance[] }>(`/api/workflows/instances?workflowId=${id}`).then(
        (d) => d.list ?? [],
      ),
  })

  const triggerMut = useMutation({
    mutationFn: () => api(`/api/workflows/${id}/trigger`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows', id, 'instances'] }),
  })
  const cancelMut = useMutation({
    mutationFn: (iId: string) => api(`/api/workflows/instances/${iId}/cancel`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows', id, 'instances'] }),
  })
  const retryMut = useMutation({
    mutationFn: (iId: string) => api(`/api/workflows/instances/${iId}/retry`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows', id, 'instances'] }),
  })

  const [tab, setTab] = React.useState<'instances' | 'definition'>('instances')
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const fmt = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  if (wfQ.isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  if (wfQ.error || !wfQ.data)
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {(wfQ.error as Error)?.message ?? t('notFound')}
      </div>
    )

  const wf = wfQ.data
  const insts = instQ.data ?? []

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => router.push('/workflows')}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Workflow className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{wf.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{wf.description || '-'}</p>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              {t(`triggers.${wf.triggerType}`)}
            </div>
          </div>
        </div>
        <Button size="sm" onClick={() => triggerMut.mutate()} disabled={triggerMut.isPending}>
          <Play className="h-4 w-4" />
          {t('detail.trigger')}
        </Button>
        {triggerMut.isError && (
          <div className="w-full text-xs text-destructive">
            {(triggerMut.error as Error).message}
          </div>
        )}
      </div>

      <div className="border-b">
        <nav className="flex gap-1">
          {(['instances', 'definition'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                tab === k
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`detail.tab_${k}`)}
            </button>
          ))}
        </nav>
      </div>

      <div key={tab} className="animate-in fade-in-0 duration-200">
        {tab === 'instances' ? (
          instQ.isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : insts.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              {t('detail.noInstances')}
            </div>
          ) : (
            <div className="space-y-2">
              {insts.map((i) => (
                <div
                  key={i.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-4 py-3"
                >
                  <span
                    className={cn(
                      'inline-flex rounded px-2 py-0.5 text-xs font-medium',
                      STATUS_BADGE[i.status],
                    )}
                  >
                    {t(`instanceStatus.${i.status}`)}
                  </span>
                  <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                    <div>
                      {t('detail.startedAt')}: {fmt(i.startedAt)}
                    </div>
                    <div>
                      {t('detail.completedAt')}: {fmt(i.completedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => router.push(`/workflows/instances/${i.id}`)}
                    >
                      {t('detail.viewInstance')}
                    </Button>
                    {(i.status === 'running' || i.status === 'pending') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-orange-600 hover:bg-orange-500/10"
                        onClick={() => cancelMut.mutate(i.id)}
                        disabled={cancelMut.isPending}
                      >
                        <Square className="h-4 w-4" />
                        {t('detail.cancel')}
                      </Button>
                    )}
                    {(i.status === 'failed' || i.status === 'cancelled') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => retryMut.mutate(i.id)}
                        disabled={retryMut.isPending}
                      >
                        <RotateCcw className="h-4 w-4" />
                        {t('detail.retry')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
              {t('detail.definition')}
            </div>
            <pre className="overflow-auto p-4 text-xs leading-relaxed">
              {JSON.stringify(wf.steps ?? [], null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
