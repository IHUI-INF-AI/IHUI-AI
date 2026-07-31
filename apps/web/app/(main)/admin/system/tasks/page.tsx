'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  ListChecks,
  Play,
  Pause,
  RotateCw,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'

interface Task {
  id: string
  name: string
  type: 'cron' | 'interval' | 'once'
  schedule: string
  status: 'running' | 'paused' | 'idle' | 'failed'
  lastRunAt: string | null
  nextRunAt: string | null
  lastDuration: number | null
  lastStatus: 'success' | 'failed' | null
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const STATUS_STYLE: Record<Task['status'], string> = {
  running: 'bg-emerald-500/10 text-emerald-600',
  paused: 'bg-muted text-muted-foreground',
  idle: 'bg-amber-500/10 text-amber-600',
  failed: 'bg-red-500/10 text-red-600',
}

export default function AdminSystemTasksPage() {
  const t = useTranslations('admin.system')
  const qc = useQueryClient()
  const [status, setStatus] = React.useState('all')

  const TYPE_LABEL: Record<Task['type'], string> = {
    cron: t('tasks.type.cron'),
    interval: t('tasks.type.interval'),
    once: t('tasks.type.once'),
  }
  const STATUS_LABEL: Record<Task['status'], string> = {
    running: t('tasks.status.running'),
    paused: t('tasks.status.paused'),
    idle: t('tasks.status.idle'),
    failed: t('tasks.status.failed'),
  }

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'system', 'tasks', status],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (status !== 'all') qs.set('status', status)
      return api<{ list: Task[] }>(`/api/admin/system/tasks?${qs.toString()}`).then(
        (d) => d.list ?? [],
      )
    },
  })

  const toggleMut = useMutation({
    mutationFn: (task: Task) =>
      api(`/api/admin/system/tasks/${task.id}/${task.status === 'paused' ? 'resume' : 'pause'}`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'system', 'tasks'] }),
  })

  const runMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/system/tasks/${id}/run`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'system', 'tasks'] }),
  })

  const runningCount = list.filter((t) => t.status === 'running').length
  const failedCount = list.filter((t) => t.status === 'failed').length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ListChecks className="h-6 w-6 text-primary" />
            {t('tasks.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('tasks.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t('tasks.status.running')} {runningCount}
          </span>
          <span className="inline-flex items-center gap-1 text-red-600">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            {t('tasks.status.failed')} {failedCount}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className={selectClass} aria-label={t('tasks.filter.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('tasks.filter.allStatus')}</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">{t('tasks.table.name')}</TableHead>
              <TableHead className="text-xs uppercase">{t('tasks.table.type')}</TableHead>
              <TableHead className="text-xs uppercase">{t('tasks.table.schedule')}</TableHead>
              <TableHead className="text-xs uppercase">{t('tasks.table.status')}</TableHead>
              <TableHead className="text-xs uppercase">{t('tasks.table.lastRun')}</TableHead>
              <TableHead className="text-xs uppercase">{t('tasks.table.nextRun')}</TableHead>
              <TableHead className="text-xs uppercase">{t('tasks.table.costTime')}</TableHead>
              <TableHead className="text-right text-xs uppercase">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  {t('tasks.noTasks')}
                </TableCell>
              </TableRow>
            ) : (
              list.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {task.lastStatus === 'success' && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      {task.lastStatus === 'failed' && (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                      {task.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-xs">
                      {TYPE_LABEL[task.type]}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {task.schedule}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs',
                        STATUS_STYLE[task.status],
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {STATUS_LABEL[task.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {task.lastRunAt ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(task.lastRunAt)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {task.nextRunAt ? formatDate(task.nextRunAt) : '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {task.lastDuration !== null && task.lastDuration !== undefined
                      ? `${task.lastDuration}ms`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={runMut.isPending}
                        onClick={() => runMut.mutate(task.id)}
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        {t('tasks.actions.run')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={toggleMut.isPending}
                        onClick={() => toggleMut.mutate(task)}
                      >
                        {task.status === 'paused' ? (
                          <Play className="h-3.5 w-3.5" />
                        ) : (
                          <Pause className="h-3.5 w-3.5" />
                        )}
                        {task.status === 'paused'
                          ? t('tasks.actions.start')
                          : t('tasks.actions.pause')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
