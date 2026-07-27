'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { InstanceHeader } from './InstanceHeader'
import { InstanceTasks } from './InstanceTasks'
import { InstanceLogs } from './InstanceLogs'
import { api } from './helpers'
import type { Instance, Task, Log, LogLevel } from './types'

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
      <InstanceHeader
        inst={inst}
        fmt={fmt}
        onBack={() => router.push(inst.workflowId ? `/workflows/${inst.workflowId}` : '/workflows')}
      />
      <InstanceTasks tasks={tasks} isLoading={tasksQ.isLoading} />
      <InstanceLogs
        logs={logs}
        isLoading={logsQ.isLoading}
        logLevel={logLevel}
        setLogLevel={setLogLevel}
        fmt={fmt}
      />
    </div>
  )
}
