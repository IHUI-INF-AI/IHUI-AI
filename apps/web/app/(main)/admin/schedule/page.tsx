'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Clock, Calendar, Play, Pause, Edit, Plus, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { Button, Card, CardHeader, CardTitle, CardContent, Switch } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { CronEditor } from '@/components/cron/CronEditor'
import { getNextRuns, describeCron } from '@/components/cron/cron-parser'

interface ScheduleTask {
  id: string
  name: string
  cron: string
  enabled: boolean
  nextRunAt: string | null
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AdminSchedulePage() {
  const locale = useLocale()
  const [cron, setCron] = React.useState('0 9 * * 1-5')
  const [editingId, setEditingId] = React.useState<string | null>(null)

  const {
    data: list = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['admin', 'schedule'],
    queryFn: async () => {
      try {
        const d = await api<{ list?: ScheduleTask[] } | ScheduleTask[]>('/api/admin/schedule')
        return Array.isArray(d) ? d : (d.list ?? [])
      } catch {
        return []
      }
    },
  })

  const dtf = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
      }),
    [locale],
  )
  const runs = React.useMemo(() => getNextRuns(cron, 5), [cron])

  function startEdit(t: ScheduleTask) {
    setEditingId(t.id)
    setCron(t.cron)
  }
  function startNew() {
    setEditingId(null)
    setCron('0 9 * * 1-5')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Clock className="h-6 w-6 text-primary" />
            定时任务
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">可视化编排 Cron 调度</p>
        </div>
        <Button size="sm" onClick={startNew}>
          <Plus className="h-4 w-4" />
          新建
        </Button>
      </div>

      {isError && (
        <Alert variant="danger" title="加载失败" description="无法获取定时任务列表,请稍后重试" />
      )}

      <div className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              暂无定时任务,点击右上角「新建」创建
            </CardContent>
          </Card>
        ) : (
          list.map((t) => (
            <Card
              key={t.id}
              className={cn(
                'transition-colors hover:bg-muted/30',
                editingId === t.id && 'ring-1 ring-primary/30',
              )}
            >
              <CardContent className="flex items-center gap-3 py-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                  {t.enabled ? (
                    <Play className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{t.name}</span>
                    <span
                      className={cn(
                        'inline-flex rounded-md px-1.5 py-0.5 text-xs',
                        t.enabled
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {t.enabled ? '启用' : '停用'}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <code className="font-mono">{t.cron}</code>
                    <span>·</span>
                    <span className="truncate">{describeCron(t.cron)}</span>
                  </div>
                </div>
                <div className="hidden text-xs text-muted-foreground sm:block">
                  {t.nextRunAt ? dtf.format(new Date(t.nextRunAt)) : '-'}
                </div>
                <Switch checked={t.enabled} disabled aria-label="任务状态" />
                <Button size="sm" variant="ghost" onClick={() => startEdit(t)}>
                  <Edit className="h-3.5 w-3.5" />
                  编辑
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CronEditor value={cron} onChange={setCron} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" />
            下次执行预览
            {editingId && <span className="text-xs font-normal text-muted-foreground">编辑中</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">无效表达式,无法计算执行时间</p>
          ) : (
            <ul className="space-y-1.5">
              {runs.map((d, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-xs font-medium text-primary">
                    {i + 1}
                  </span>
                  {dtf.format(d)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
