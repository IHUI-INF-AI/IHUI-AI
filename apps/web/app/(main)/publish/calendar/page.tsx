'use client'

/**
 * 发布日历页 — 拉取任务 + 组合 PublishCalendar 组件。
 * 拖拽改期调 POST /api/publish/tasks/{task_id}/reschedule(真实改期)。
 *
 * AGENTS.md §4:< 200 行 / rounded-md / 无分割线
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { reschedulePublishTask } from '@ihui/api-client'
import { useToast } from '@/hooks/use-toast'
import { BackButton } from '@/components/common'
import { PublishCalendar, type ScheduledTask } from '@/components/publish/PublishCalendar'

interface Task {
  id: number
  taskId?: string
  title: string
  status: string
  scheduledAt?: string | null
  createdAt?: string
  targets?: ReadonlyArray<{ platform: string; accountId?: number }>
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function CalendarPage() {
  const t = useTranslations('publish')
  const toast = useToast()
  const router = useRouter()
  const [tasks, setTasks] = React.useState<ScheduledTask[]>([])
  const [loading, setLoading] = React.useState(true)
  const [reschedulingId, setReschedulingId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ items?: Task[]; list?: Task[] } | Task[]>(
        '/api/publish/tasks?limit=200',
      )
      const list = Array.isArray(res) ? res : (res.items ?? res.list ?? [])
      setTasks(
        list.map((task) => ({
          id: task.taskId ?? String(task.id),
          title: task.title,
          scheduledAt: task.scheduledAt ?? task.createdAt ?? new Date().toISOString(),
          status: (task.status === 'success'
            ? 'published'
            : task.status === 'failed'
              ? 'failed'
              : task.status === 'scheduled'
                ? 'scheduled'
                : 'draft') as ScheduledTask['status'],
          platform: task.targets?.[0]?.platform,
        })),
      )
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    void load()
  }, [load])

  async function handleReschedule(taskId: string, newDate: Date) {
    if (reschedulingId) return
    setReschedulingId(taskId)
    try {
      const r = await reschedulePublishTask(taskId, newDate.toISOString())
      if (!r.success) {
        toast.error(r.error || 'Reschedule failed')
        return
      }
      toast.success(t('calendar.rescheduled', { date: newDate.toLocaleDateString('zh-CN') }))
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setReschedulingId(null)
    }
  }

  function handleCreateTask(date: Date) {
    const dateStr = date.toISOString().slice(0, 16)
    router.push(`/publish/new?scheduled=${encodeURIComponent(dateStr)}`)
  }

  return (
    <div className="space-y-3">
      <BackButton />
      <div>
        <h2 className="text-base font-semibold">{t('calendar.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('calendar.subtitle')}</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <PublishCalendar
          tasks={tasks}
          onReschedule={handleReschedule}
          onCreateTask={handleCreateTask}
        />
      )}
    </div>
  )
}
