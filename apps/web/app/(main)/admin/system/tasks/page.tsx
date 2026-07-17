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
} from '@ihui/ui'
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
const TYPE_LABEL: Record<Task['type'], string> = { cron: '定时', interval: '周期', once: '单次' }
const STATUS_STYLE: Record<Task['status'], string> = {
  running: 'bg-emerald-500/10 text-emerald-600',
  paused: 'bg-muted text-muted-foreground',
  idle: 'bg-amber-500/10 text-amber-600',
  failed: 'bg-red-500/10 text-red-600',
}
const STATUS_LABEL: Record<Task['status'], string> = {
  running: '运行中',
  paused: '已暂停',
  idle: '空闲',
  failed: '失败',
}

export default function AdminSystemTasksPage() {
  const qc = useQueryClient()
  const [status, setStatus] = React.useState('all')

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
    mutationFn: (t: Task) =>
      api(`/api/admin/system/tasks/${t.id}/${t.status === 'paused' ? 'resume' : 'pause'}`, {
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
            系统任务
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">定时任务与后台作业管理</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            运行中 {runningCount}
          </span>
          <span className="inline-flex items-center gap-1 text-red-600">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            失败 {failedCount}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className={selectClass} aria-label="状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
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
              <TableHead className="text-xs uppercase">任务名称</TableHead>
              <TableHead className="text-xs uppercase">类型</TableHead>
              <TableHead className="text-xs uppercase">调度</TableHead>
              <TableHead className="text-xs uppercase">状态</TableHead>
              <TableHead className="text-xs uppercase">上次运行</TableHead>
              <TableHead className="text-xs uppercase">下次运行</TableHead>
              <TableHead className="text-xs uppercase">耗时</TableHead>
              <TableHead className="text-right text-xs uppercase">操作</TableHead>
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
                  暂无任务
                </TableCell>
              </TableRow>
            ) : (
              list.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {t.lastStatus === 'success' && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      {t.lastStatus === 'failed' && (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                      {t.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-xs">
                      {TYPE_LABEL[t.type]}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {t.schedule}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs',
                        STATUS_STYLE[t.status],
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {STATUS_LABEL[t.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.lastRunAt ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(t.lastRunAt)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.nextRunAt ? formatDate(t.nextRunAt) : '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.lastDuration !== null && t.lastDuration !== undefined
                      ? `${t.lastDuration}ms`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={runMut.isPending}
                        onClick={() => runMut.mutate(t.id)}
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        执行
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={toggleMut.isPending}
                        onClick={() => toggleMut.mutate(t)}
                      >
                        {t.status === 'paused' ? (
                          <Play className="h-3.5 w-3.5" />
                        ) : (
                          <Pause className="h-3.5 w-3.5" />
                        )}
                        {t.status === 'paused' ? '启动' : '暂停'}
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
