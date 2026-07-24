'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, Video, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui-react'

import { VideoTaskStatusBadge } from './status-badge'
import {
  VideoTaskRowExpansion,
  VideoTaskRowLoading,
  VideoTaskRowError,
  type VideoTask,
} from './video-task-row'

interface ListData {
  list: VideoTask[]
  total: number
  page: number
  pageSize: number
}

interface DetailData {
  task: VideoTask
  warning?: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error || 'Request failed')
  return r.data
}

export default function VideoTasksPage() {
  const locale = useLocale()
  const t = useTranslations('videoTasksPage')
  const [expandedId, setExpandedId] = React.useState<number | null>(null)

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const listQuery = useQuery({
    queryKey: ['jimeng-video-tasks'],
    queryFn: () => api<ListData>('/api/ai/jimeng4/video/tasks?page=1&pageSize=20'),
    refetchInterval: (q) => {
      const list = q.state.data?.list ?? []
      return list.some((t) => t.status === 'accepted' || t.status === 'running') ? 5000 : false
    },
  })

  const detailQuery = useQuery({
    queryKey: ['jimeng-video-task', expandedId],
    queryFn: () => api<DetailData>(`/api/ai/jimeng4/video/tasks/${expandedId}`),
    enabled: expandedId !== null,
    refetchInterval: (q) => {
      const task = q.state.data?.task
      if (!task) return false
      return task.status === 'accepted' || task.status === 'running' ? 5000 : false
    },
  })

  const tasks = listQuery.data?.list ?? []
  const expandedTask = detailQuery.data?.task

  const toggleExpand = (id: number) => {
    setExpandedId((cur) => (cur === id ? null : id))
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Video className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => listQuery.refetch()}
          disabled={listQuery.isFetching}
        >
          <RefreshCw className={`mr-1 h-4 w-4 ${listQuery.isFetching ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('taskList')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : listQuery.error ? (
            <div className="m-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {(listQuery.error as Error).message}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <Video className="h-8 w-8 opacity-40" />
              <p className="text-sm">{t('empty')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead>{t('promptSummary')}</TableHead>
                  <TableHead className="w-24">{t('status')}</TableHead>
                  <TableHead className="w-40">{t('createdAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const isExpanded = expandedId === task.id
                  return (
                    <React.Fragment key={task.id}>
                      <TableRow
                        className="cursor-pointer transition-colors hover:bg-accent/40"
                        onClick={() => toggleExpand(task.id)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">#{task.id}</TableCell>
                        <TableCell className="max-w-md truncate text-sm">
                          {task.message || '-'}
                        </TableCell>
                        <TableCell>
                          <VideoTaskStatusBadge status={task.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmt(task.createdAt)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={5} className="p-4">
                            {detailQuery.isFetching && !expandedTask ? (
                              <VideoTaskRowLoading />
                            ) : detailQuery.error ? (
                              <VideoTaskRowError error={detailQuery.error} />
                            ) : expandedTask ? (
                              <VideoTaskRowExpansion
                                task={expandedTask}
                                warning={detailQuery.data?.warning}
                              />
                            ) : null}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
