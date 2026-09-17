// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * AgentTasksPanel — agent 运行任务面板 + 中途插话(P3 #44 阶段3 前端宿主,2026-09-17 立)。
 *
 * 数据源:/api/workspace/agent/tasks(agentLoop 内存任务,由 /agent/run 创建)。
 * - 列表:taskId/goal/status/迭代数,运行中任务展示插话输入框
 * - 插话:POST /api/workspace/agent/tasks/:taskId/inject(下一轮迭代消费,
 *   机制见 apps/api/src/services/workspace-ai-service.ts injectMessage)
 */

import * as React from 'react'
import { Loader2, MessageSquarePlus, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge, Button, Input } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface AgentTaskItem {
  taskId: string
  goal: string
  status: string
  iterations: number
  startedAt?: string
}

const STATUS_CLASS: Record<string, string> = {
  running: 'border-transparent bg-amber-500/15 text-amber-600 hover:bg-amber-500/15',
  completed: 'border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15',
  failed: 'border-transparent bg-destructive/15 text-destructive hover:bg-destructive/15',
  canceled: 'border-transparent bg-muted text-muted-foreground hover:bg-muted',
}

export function AgentTasksPanel() {
  const t = useTranslations('agentTasks')
  const toast = useToast()
  const [tasks, setTasks] = React.useState<AgentTaskItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [injecting, setInjecting] = React.useState<string | null>(null)
  // 每任务独立输入框状态(taskId → 草稿)
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi<{ tasks: Record<string, AgentTaskItem> }>(
        '/api/workspace/agent/tasks',
      )
      const list = res.success && res.data ? Object.values(res.data.tasks) : []
      // 新到旧(创建时间倒序)
      list.sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? '') * -1)
      setTasks(list)
    } catch {
      setTasks([])
      toast.error(t('toastLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t, toast])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleInject = async (taskId: string) => {
    const content = (drafts[taskId] ?? '').trim()
    if (!content) return
    setInjecting(taskId)
    try {
      const res = await fetchApi<{ accepted: boolean }>(
        `/api/workspace/agent/tasks/${encodeURIComponent(taskId)}/inject`,
        { method: 'POST', body: JSON.stringify({ content }) },
      )
      if (res.success && res.data?.accepted) {
        toast.success(t('toastInjected'))
        setDrafts((d) => ({ ...d, [taskId]: '' }))
      } else {
        toast.error(t('toastInjectRejected'))
      }
    } catch {
      toast.error(t('toastInjectFailed'))
    } finally {
      setInjecting(null)
    }
  }

  return (
    <div className="space-y-3 px-1 py-2" data-testid="agent-tasks-panel">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('title')}</span>
        <Button variant="outline" size="xs" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          {t('refresh')}
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-md bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <div key={task.taskId} className="rounded-md border border-border bg-card p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={cn(
                    'border-transparent',
                    STATUS_CLASS[task.status] ?? STATUS_CLASS.canceled,
                  )}
                >
                  {task.status}
                </Badge>
                <span className="font-mono text-[10px] text-muted-foreground">{task.taskId}</span>
                <span className="text-xs text-muted-foreground">
                  {t('iterations', { count: task.iterations })}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.goal}</p>
              {task.status === 'running' && (
                <div className="mt-2 flex items-center gap-1.5">
                  <Input
                    value={drafts[task.taskId] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [task.taskId]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleInject(task.taskId)
                    }}
                    placeholder={t('injectPlaceholder')}
                    maxLength={2000}
                    className="h-7 flex-1 text-xs"
                    data-testid={`agent-inject-input-${task.taskId}`}
                  />
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => void handleInject(task.taskId)}
                    disabled={injecting === task.taskId || !(drafts[task.taskId] ?? '').trim()}
                    data-testid={`agent-inject-btn-${task.taskId}`}
                  >
                    {injecting === task.taskId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                    )}
                    {t('inject')}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AgentTasksPanel
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
