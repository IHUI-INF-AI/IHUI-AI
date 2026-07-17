'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Clock,
  CalendarClock,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, Input, Button } from '@ihui/ui'
import { formatDate } from '@/lib/date-utils'

interface ScheduleTask {
  id: string
  name: string
  description: string | null
  cronExpression: string
  targetService: string | null
  targetMethod: string | null
  priority: number
  enabled: boolean
  lastRunTime: string | null
  lastRunStatus: string | null
  createdAt: string
}
interface TasksData {
  list: ScheduleTask[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function SchedulePage() {
  const t = useTranslations('schedule')

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['schedule', 'tasks', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('name', debounced)
      return api<TasksData>(`/api/schedule/tasks?${qs.toString()}`)
    },
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const tasks = data?.list ?? []

  const statusIcon = (status: string | null) => {
    if (!status) return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
    if (status === 'success') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
    if (status === 'failed' || status === 'timeout')
      return <XCircle className="h-3.5 w-3.5 text-destructive" />
    return <PlayCircle className="h-3.5 w-3.5 text-primary" />
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <CalendarClock className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('taskList')}</h2>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchTask')}
            className="h-9 pl-8"
            aria-label={t('searchTask')}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <CalendarClock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <Card key={task.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{task.name}</CardTitle>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs ${
                      task.enabled
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {task.enabled ? t('enabled') : t('disabled')}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm">
                {task.description && <p className="text-muted-foreground">{task.description}</p>}
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{task.cronExpression}</span>
                </div>
                {task.targetService && (
                  <p className="text-xs text-muted-foreground">
                    {task.targetService}
                    {task.targetMethod ? `.${task.targetMethod}` : ''}
                  </p>
                )}
                <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {statusIcon(task.lastRunStatus)}
                    {task.lastRunStatus ?? t('neverRun')}
                  </span>
                  <span>{t('priority', { priority: task.priority })}</span>
                </div>
                {task.lastRunTime && (
                  <p className="text-xs text-muted-foreground">{formatDate(task.lastRunTime)}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
