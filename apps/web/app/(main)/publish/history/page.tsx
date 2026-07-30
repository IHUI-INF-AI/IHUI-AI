'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, ExternalLink, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@ihui/ui-react'
import { PLATFORM_KEY } from '../helpers'

const STATUS_LABEL: Record<string, string> = {
  success: '成功',
  failed: '失败',
  pending: '待处理',
  running: '运行中',
  skipped: '跳过',
}

// 后端契约:publish.py list_tasks 返回 camelCase 字段(非 snake_case)
// 注意:/publish/tasks 列表不返回 targets/duration_ms,返回 platformCount
interface Target {
  platform: string
  accountId?: number
  status?: string
  url?: string | null
  error?: string | null
  durationMs?: number
}
interface Task {
  id: number
  taskId?: string
  title: string
  format?: string
  status: string
  createdAt?: string
  updatedAt?: string
  scheduledAt?: string | null
  platformCount?: number
  targets?: Target[]
  error?: string | null
}
// 后端契约:publish.py get_stats 返回 {tasks: {total, success, failed, partial, ...}, ...}
// tasks 是嵌套对象,不是顶层字段;没有 success_rate 字段
interface Stats {
  tasks?: {
    total?: number
    success?: number
    failed?: number
    partial?: number
  }
}

const PLATFORMS = [
  'wordpress',
  'medium',
  'youtube',
  'bilibili',
  'wechat',
  'toutiao',
  'douyin',
  'kuaishou',
  'weibo',
  'zhihu',
  'csdn',
  'juejin',
  'xiaohongshu',
  'shipinhao',
] as const

const STATUS_STYLE: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  skipped: 'bg-muted text-muted-foreground',
}

const TIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
})

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fmtDuration(ms?: number) {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

export default function HistoryPage() {
  const t = useTranslations('publish')
  const toast = useToast()
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [stats, setStats] = React.useState<Stats>({})
  const [loading, setLoading] = React.useState(true)
  const [filterPlatform, setFilterPlatform] = React.useState<string>('all')
  const [filterStatus, setFilterStatus] = React.useState<string>('all')
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set())

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      // 后端契约:/publish/tasks 列表返回 {items: [...], count, limit, offset}
      // 任务列表才有 title/format 字段;/publish/history 是单平台粒度,无 title/format
      const [histRes, statsRes] = await Promise.all([
        api<{ items?: Task[]; list?: Task[] } | Task[]>('/api/publish/tasks?limit=50'),
        api<Stats>('/api/publish/stats').catch(() => ({})),
      ])
      const list = Array.isArray(histRes) ? histRes : (histRes.items ?? histRes.list ?? [])
      setTasks(list)
      setStats(statsRes)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    void load()
  }, [load])

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = tasks.filter((task) => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false
    if (filterPlatform !== 'all') {
      const has = task.targets?.some((tg) => tg.platform === filterPlatform)
      if (!has) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{t('stats.totalTasks')}</div>
            <div className="mt-1 text-lg font-semibold">{stats.tasks?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{t('stats.totalSuccess')}</div>
            <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
              {stats.tasks?.success ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{t('stats.totalFailed')}</div>
            <div className="mt-1 text-lg font-semibold text-rose-600 dark:text-rose-400">
              {stats.tasks?.failed ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{t('stats.successRate')}</div>
            <div className="mt-1 text-lg font-semibold">
              {stats.tasks?.total && stats.tasks?.success
                ? `${((stats.tasks.success / stats.tasks.total) * 100).toFixed(1)}%`
                : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('history.filterPlatform')}</label>
            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('history.allPlatforms')}</SelectItem>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(PLATFORM_KEY[p] ?? 'platforms.unknown')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('history.filterStatus')}</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('history.allStatus')}</SelectItem>
                <SelectItem value="success">{t('history.statusSuccess')}</SelectItem>
                <SelectItem value="failed">{t('history.statusFailed')}</SelectItem>
                <SelectItem value="skipped">{t('history.statusSkipped')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('history.noHistory')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const isOpen = expanded.has(task.id)
            const statusKey = task.status in STATUS_STYLE ? task.status : 'pending'
            return (
              <Card key={task.id}>
                <CardContent className="p-3">
                  <button
                    type="button"
                    onClick={() => toggle(task.id)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{task.title}</span>
                        <span
                          className={cn(
                            'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                            STATUS_STYLE[statusKey],
                          )}
                        >
                          {STATUS_LABEL[task.status] ?? task.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>
                          {t('history.time')}:{' '}
                          {task.createdAt ? TIME_FMT.format(new Date(task.createdAt)) : '-'}
                        </span>
                        {typeof task.platformCount === 'number' && (
                          <span>平台数: {task.platformCount}</span>
                        )}
                        {task.format && <span className="font-mono">{task.format}</span>}
                      </div>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="mt-3 space-y-2 rounded-md bg-muted/40 p-3 text-xs">
                      {task.targets && task.targets.length > 0 && (
                        <div className="space-y-1">
                          {task.targets.map((tg, i) => (
                            <div
                              key={`${tg.accountId ?? tg.platform}-${i}`}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <span className="font-medium">
                                {t(PLATFORM_KEY[tg.platform] ?? 'platforms.unknown')}
                              </span>
                              <span
                                className={cn(
                                  'rounded px-1.5 py-0.5 text-[10px]',
                                  STATUS_STYLE[tg.status ?? 'pending'] ?? STATUS_STYLE.pending,
                                )}
                              >
                                {STATUS_LABEL[tg.status ?? 'pending'] ?? tg.status}
                              </span>
                              {tg.durationMs !== undefined && tg.durationMs !== null && (
                                <span className="text-muted-foreground">
                                  {fmtDuration(tg.durationMs)}
                                </span>
                              )}
                              {tg.url && (
                                <a
                                  href={tg.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {t('history.openUrl')}
                                </a>
                              )}
                              {tg.error && (
                                <span className="text-rose-600 dark:text-rose-400">{tg.error}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {task.error && (
                        <pre className="thin-scroll max-h-32 overflow-auto rounded bg-rose-50 p-2 text-[10px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                          {task.error}
                        </pre>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
