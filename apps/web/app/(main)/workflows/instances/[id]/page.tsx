'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, ArrowLeft, ListChecks, ScrollText, ChevronRight, ChevronDown } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { cn } from '@/lib/utils'

type InstStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
type LogLevel = 'debug' | 'info' | 'warn' | 'error'
interface Instance {
  id: string
  status: InstStatus
  workflowId?: string
  workflowName?: string
  startedAt?: string
  completedAt?: string
  input?: unknown
  output?: unknown
}
interface Task {
  id: string
  step: number
  name: string
  type: string
  status: InstStatus
  input?: unknown
  output?: unknown
}
interface Log {
  id: string
  timestamp: string
  level: LogLevel
  message: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
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
const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: 'text-muted-foreground',
  info: 'text-primary',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
}
const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']

export default function InstanceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('workflows')
  const locale = useLocale()
  const [logLevel, setLogLevel] = React.useState<'all' | LogLevel>('all')

  const instQ = useQuery({
    queryKey: ['wf', 'instance', id],
    queryFn: () =>
      api<{ instance: Instance }>(`/api/workflows/instances/${id}`).then((d) => d.instance),
  })
  const tasksQ = useQuery({
    queryKey: ['wf', 'instance', id, 'tasks'],
    queryFn: () =>
      api<{ list: Task[] }>(`/api/workflows/instances/${id}/tasks`).then((d) => d.list ?? []),
  })
  const logsQ = useQuery({
    queryKey: ['wf', 'instance', id, 'logs'],
    queryFn: () =>
      api<{ list: Log[] }>(`/api/workflows/instances/${id}/logs`).then((d) => d.list ?? []),
  })

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

  if (instQ.isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  if (instQ.error || !instQ.data)
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {(instQ.error as Error)?.message ?? t('instanceDetail.notFound')}
      </div>
    )

  const inst = instQ.data
  const tasks = tasksQ.data ?? []
  const logs = (logsQ.data ?? []).filter((l) => logLevel === 'all' || l.level === logLevel)

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() =>
          router.push(inst.workflowId ? `/workflows/${inst.workflowId}` : '/workflows')
        }
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('instanceDetail.backToWorkflow')}
      </button>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <span
          className={cn(
            'inline-flex rounded px-2 py-0.5 text-xs font-medium',
            STATUS_BADGE[inst.status],
          )}
        >
          {t(`instanceStatus.${inst.status}`)}
        </span>
        {inst.workflowName && <span className="text-sm font-medium">{inst.workflowName}</span>}
        <div className="text-xs text-muted-foreground">
          <span>
            {t('instanceDetail.startedAt')}: {fmt(inst.startedAt)}
          </span>
          <span className="ml-3">
            {t('instanceDetail.completedAt')}: {fmt(inst.completedAt)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-primary" />
          {t('instanceDetail.tasks')}
        </h2>
        {tasksQ.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            {t('instanceDetail.noTasks')}
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ScrollText className="h-4 w-4 text-primary" />
            {t('instanceDetail.logs')}
          </h2>
          <Select value={logLevel} onValueChange={(v) => setLogLevel(v as 'all' | LogLevel)}>
            <SelectTrigger className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('instanceDetail.allLevels')}</SelectItem>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {logsQ.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            {t('instanceDetail.noLogs')}
          </div>
        ) : (
          <div className="max-h-96 overflow-auto rounded-lg border bg-card">
            {logs.map((l) => (
              <div
                key={l.id}
                className="flex items-start gap-3 border-b px-3 py-1.5 text-xs last:border-0 transition-colors hover:bg-muted/30"
              >
                <span className="shrink-0 font-mono text-muted-foreground">{fmt(l.timestamp)}</span>
                <span className={cn('w-12 shrink-0 font-semibold uppercase', LEVEL_COLOR[l.level])}>
                  {l.level}
                </span>
                <span className="min-w-0 flex-1 break-all">{l.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task }: { task: Task }) {
  const t = useTranslations('workflows')
  const [open, setOpen] = React.useState(false)
  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <span className="w-8 shrink-0 text-xs text-muted-foreground">#{task.step}</span>
        <span className="min-w-0 flex-1 break-words text-sm font-medium">{task.name}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {task.type}
        </span>
        <span
          className={cn('rounded px-1.5 py-0.5 text-xs font-medium', STATUS_BADGE[task.status])}
        >
          {t(`instanceStatus.${task.status}`)}
        </span>
      </button>
      {open && (
        <div className="grid gap-2 border-t px-4 py-2 text-xs sm:grid-cols-2">
          <div>
            <div className="mb-1 font-medium text-muted-foreground">
              {t('instanceDetail.input')}
            </div>
            <pre className="overflow-auto rounded bg-muted p-2 leading-relaxed">
              {JSON.stringify(task.input ?? null, null, 2)}
            </pre>
          </div>
          <div>
            <div className="mb-1 font-medium text-muted-foreground">
              {t('instanceDetail.output')}
            </div>
            <pre className="overflow-auto rounded bg-muted p-2 leading-relaxed">
              {JSON.stringify(task.output ?? null, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
