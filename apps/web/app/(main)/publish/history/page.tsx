// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 发布历史页:数据拉取 + 筛选状态 + 组合 StatsCards / FilterBar / TaskCard 列表。
 * AGENTS.md §4:< 200 行 / rounded-md / 无分割线 / 无渐变遮罩
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, BarChart3 } from 'lucide-react'
import { apiOrThrow } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { BackButton } from '@/components/common'
import { SchedulerBanner, type SchedulerSnapshot } from '@/components/publish/SchedulerBanner'
import { StatsCards } from './StatsCards'
import { FilterBar } from './FilterBar'
import { TaskCard } from './TaskCard'
import { normalizeHistoryStatusFilter, normalizeHistoryTaskFocus } from './history-helpers'

interface Target {
  platform: string
  accountId?: number
  status?: string
  url?: string | null
  error?: string | null
  durationMs?: number
}
/** 单平台真实执行结果(2026-08-17 新增,后端列表 platforms 字段) */
interface PlatformResult {
  platform: string
  success: boolean
  publishedUrl?: string | null
  platformContentId?: string | null
  errorMessage?: string | null
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
  platforms?: PlatformResult[]
  error?: string | null
}
interface Stats {
  tasks?: {
    total?: number
    success?: number
    failed?: number
    partial?: number
    overdue?: number
    nextScheduledAt?: string | null
  }
  scheduler?: SchedulerSnapshot
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
  const [focusTaskId, setFocusTaskId] = React.useState<string | null>(null)

  const load = React.useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const [histRes, statsRes] = await Promise.all([
          apiOrThrow<{ items?: Task[]; list?: Task[] } | Task[]>('/api/publish/tasks?limit=50'),
          apiOrThrow<Stats>('/api/publish/stats').catch(() => ({})),
        ])
        const list = Array.isArray(histRes) ? histRes : (histRes.items ?? histRes.list ?? [])
        setTasks(list)
        setStats(statsRes)
      } catch (e) {
        // 后台轮询失败不弹 toast:网络抖动时不要让用户每隔 20 秒被打断一次。
        if (!silent) toast.error((e as Error).message)
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [toast],
  )

  React.useEffect(() => {
    void load()
  }, [load])

  const hasActiveTasks = tasks.some(
    (task) => task.status === 'scheduled' || task.status === 'running' || task.status === 'pending',
  )

  // 有排期/发布中的任务时,20 秒静默刷新一次:调度器到点执行后,用户不用手点刷新就能看到状态变化。
  // 没有活动任务时不轮询,避免空页面持续打 DB。
  React.useEffect(() => {
    if (!hasActiveTasks) return
    const timer = window.setInterval(() => void load(true), 20_000)
    return () => window.clearInterval(timer)
  }, [hasActiveTasks, load])

  // 切回标签页时补一次静默刷新,覆盖浏览器后台节流导致定时器暂停的情况。
  React.useEffect(() => {
    if (!hasActiveTasks) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [hasActiveTasks, load])

  // /start 的“待确认草稿/失败待处理”卡带 ?status= 进来；未知值回退 all。
  // 一句话出稿成功后的“去确认”还会带 ?task=，这里一起收，避免用户到了列表再翻。
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setFilterStatus(normalizeHistoryStatusFilter(params.get('status')))
    setFocusTaskId(normalizeHistoryTaskFocus(params.get('task')))
  }, [])

  const focusedTask = React.useMemo(() => {
    if (!focusTaskId) return null
    return (
      tasks.find(
        (task) => (task.taskId && task.taskId === focusTaskId) || String(task.id) === focusTaskId,
      ) ?? null
    )
  }, [focusTaskId, tasks])

  // 定位到具体草稿：自动展开；若它不在当前状态筛选里，先退回 all 保证可见。
  React.useEffect(() => {
    if (loading || !focusedTask) return
    setExpanded((prev) => {
      if (prev.has(focusedTask.id)) return prev
      const next = new Set(prev)
      next.add(focusedTask.id)
      return next
    })
    setFilterStatus((prev) => (prev === 'all' || focusedTask.status === prev ? prev : 'all'))
    const timer = window.setTimeout(() => {
      document
        .getElementById(`publish-task-${focusedTask.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [loading, focusedTask])

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
    <div className="px-4 space-y-4">
      <BackButton />
      <SchedulerBanner
        scheduler={stats.scheduler}
        overdue={stats.tasks?.overdue}
        nextScheduledAt={stats.tasks?.nextScheduledAt}
      />
      <StatsCards stats={stats} />
      <FilterBar
        filterPlatform={filterPlatform}
        onFilterPlatformChange={setFilterPlatform}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
      />
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
          <p className="text-body text-muted-foreground">{t('history.noHistory')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div
              key={task.id}
              id={`publish-task-${task.id}`}
              className={
                focusedTask?.id === task.id ? 'rounded-lg ring-2 ring-primary/30' : undefined
              }
            >
              <TaskCard
                task={task}
                expanded={expanded.has(task.id)}
                onToggle={toggle}
                onChanged={() => void load()}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
