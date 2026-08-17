'use client'

/**
 * 发布历史页:数据拉取 + 筛选状态 + 组合 StatsCards / FilterBar / TaskCard 列表。
 * AGENTS.md §4:< 200 行 / rounded-md / 无分割线 / 无渐变遮罩
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, BarChart3 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { BackButton } from '@/components/common'
import { StatsCards } from './StatsCards'
import { FilterBar } from './FilterBar'
import { TaskCard } from './TaskCard'

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
  }
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
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
      <BackButton />
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
          <p className="text-sm text-muted-foreground">{t('history.noHistory')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              expanded={expanded.has(task.id)}
              onToggle={toggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
