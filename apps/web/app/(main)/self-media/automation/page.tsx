'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Clock,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  History,
  Settings2,
  Power,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Switch } from '@ihui/ui'

interface TaskConfig {
  hour: number
  minute: number
  dryRun: boolean
  enabled: boolean
  titleTemplate: string
}

interface LastRun {
  task_id: string
  triggered_at: string
  status: 'success' | 'failed' | 'running'
  duration_ms: number
  error: string | null
  extra: Record<string, unknown>
}

interface Task {
  id: string
  name: string
  description: string
  category: 'wechat' | 'koubo'
  defaultHour: number
  defaultMinute: number
  config: TaskConfig
  running: boolean
  lastRun: LastRun | null
}

interface HistoryItem {
  task_id: string
  triggered_at: string
  status: 'success' | 'failed' | 'running'
  duration_ms: number
  error: string | null
  extra: Record<string, unknown>
}

export default function AutomationPage() {
  const t = useTranslations('selfMedia.automationPage')
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [history, setHistory] = React.useState<HistoryItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null)
  // 编辑表单本地状态
  const [editHour, setEditHour] = React.useState(0)
  const [editMinute, setEditMinute] = React.useState(0)
  const [editDryRun, setEditDryRun] = React.useState(true)
  const [editTitleTpl, setEditTitleTpl] = React.useState('')
  const [saving, setSaving] = React.useState<'saving' | null>(null)
  const [triggeringId, setTriggeringId] = React.useState<string | null>(null)
  const [togglingId, setTogglingId] = React.useState<string | null>(null)

  const loadAll = React.useCallback(async () => {
    const [tasksRes, historyRes] = await Promise.all([
      fetchApi<{ items: Task[] }>('/api/self-media/automation/tasks'),
      fetchApi<{ items: HistoryItem[] }>('/api/self-media/automation/history?limit=30'),
    ])
    if (tasksRes.success && tasksRes.data) setTasks(tasksRes.data.items ?? [])
    if (historyRes.success && historyRes.data) setHistory(historyRes.data.items ?? [])
  }, [])

  React.useEffect(() => {
    void (async () => {
      setLoading(true)
      await loadAll()
      setLoading(false)
    })()
    // 每 10s 轮询一次,获取最新状态(运行中任务 / 历史更新)
    const timer = setInterval(loadAll, 10000)
    return () => clearInterval(timer)
  }, [loadAll])

  const handleToggle = async (task: Task) => {
    setTogglingId(task.id)
    try {
      await fetchApi(`/api/self-media/automation/tasks/${task.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !task.config.enabled }),
      })
      await loadAll()
    } finally {
      setTogglingId(null)
    }
  }

  const handleTrigger = async (task: Task) => {
    setTriggeringId(task.id)
    try {
      await fetchApi(`/api/self-media/automation/tasks/${task.id}/trigger`, {
        method: 'POST',
      })
      // 立即刷新一次,等几秒后再刷一次(让 running 状态显示出来)
      await loadAll()
      setTimeout(loadAll, 3000)
    } finally {
      setTriggeringId(null)
    }
  }

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id)
    setEditHour(task.config.hour)
    setEditMinute(task.config.minute)
    setEditDryRun(task.config.dryRun)
    setEditTitleTpl(task.config.titleTemplate)
  }

  const cancelEdit = () => {
    setEditingTaskId(null)
  }

  const saveEdit = async (task: Task) => {
    setSaving('saving')
    try {
      await fetchApi(`/api/self-media/automation/tasks/${task.id}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hour: editHour,
          minute: editMinute,
          dryRun: editDryRun,
          titleTemplate: editTitleTpl || undefined,
        }),
      })
      setEditingTaskId(null)
      await loadAll()
    } finally {
      setSaving(null)
    }
  }

  const formatTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Shanghai',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Shanghai',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}min`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 任务列表 */}
      <div className="grid gap-4 md:grid-cols-2">
        {tasks.map((task) => {
          const isEditing = editingTaskId === task.id
          const isTriggering = triggeringId === task.id
          const isToggling = togglingId === task.id
          return (
            <Card key={task.id}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <div>
                      <div className="font-semibold">{task.name}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {task.description}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {task.running && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        运行中
                      </span>
                    )}
                    <Switch
                      checked={task.config.enabled}
                      onCheckedChange={() => handleToggle(task)}
                      disabled={isToggling}
                      aria-label="启用/禁用任务"
                    />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                {/* 当前配置展示 */}
                {!isEditing && (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="text-muted-foreground">执行时间</span>
                      <code className="font-mono">
                        {String(task.config.hour).padStart(2, '0')}:
                        {String(task.config.minute).padStart(2, '0')}
                      </code>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="text-muted-foreground">运行模式</span>
                      <span>
                        {task.config.dryRun ? (
                          <span className="text-amber-600">dry-run(不推送)</span>
                        ) : (
                          <span className="text-emerald-600">正式(实际推送)</span>
                        )}
                      </span>
                    </div>
                    {task.id === 'wechat_daily' && (
                      <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                        <span className="text-muted-foreground">标题模板</span>
                        <code className="max-w-[60%] truncate font-mono">
                          {task.config.titleTemplate || '(未配置)'}
                        </code>
                      </div>
                    )}
                    <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="text-muted-foreground">状态</span>
                      <span
                        className={
                          task.config.enabled
                            ? 'font-medium text-emerald-600'
                            : 'text-muted-foreground'
                        }
                      >
                        {task.config.enabled ? '已启用' : '已禁用'}
                      </span>
                    </div>
                    {task.lastRun && (
                      <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                        <span className="text-muted-foreground">最近一次</span>
                        <span className="flex items-center gap-1.5">
                          {task.lastRun.status === 'success' ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          ) : task.lastRun.status === 'failed' ? (
                            <XCircle className="h-3 w-3 text-rose-600" />
                          ) : (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          <span>
                            {formatTime(task.lastRun.triggered_at)} ·{' '}
                            {formatDuration(task.lastRun.duration_ms)}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 编辑表单 */}
                {isEditing && (
                  <div className="space-y-2.5 rounded-md border border-border p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`hour-${task.id}`} className="text-xs">
                          小时 (0-23)
                        </Label>
                        <Input
                          id={`hour-${task.id}`}
                          type="number"
                          min={0}
                          max={23}
                          value={editHour}
                          onChange={(e) => setEditHour(Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`minute-${task.id}`} className="text-xs">
                          分钟 (0-59)
                        </Label>
                        <Input
                          id={`minute-${task.id}`}
                          type="number"
                          min={0}
                          max={59}
                          value={editMinute}
                          onChange={(e) => setEditMinute(Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                      <Label htmlFor={`dryrun-${task.id}`} className="text-xs">
                        dry-run 模式(不实际推送草稿箱)
                      </Label>
                      <Switch
                        id={`dryrun-${task.id}`}
                        checked={editDryRun}
                        onCheckedChange={setEditDryRun}
                      />
                    </div>
                    {task.id === 'wechat_daily' && (
                      <div className="space-y-1">
                        <Label htmlFor={`title-${task.id}`} className="text-xs">
                          标题模板(可用 {'{date}'} 占位符替换为 MMDD)
                        </Label>
                        <Input
                          id={`title-${task.id}`}
                          value={editTitleTpl}
                          onChange={(e) => setEditTitleTpl(e.target.value)}
                          placeholder="如:今日 AI 资讯 {date}"
                          className="text-xs"
                        />
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={saving !== null}
                        className="h-7 text-xs"
                      >
                        取消
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => saveEdit(task)}
                        disabled={saving !== null}
                        className="h-7 text-xs"
                      >
                        {saving === 'saving' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : null}
                        保存
                      </Button>
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                {!isEditing && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTrigger(task)}
                      disabled={task.running || isTriggering}
                      className="h-7 text-xs"
                    >
                      {isTriggering ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      立即触发
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(task)}
                      className="h-7 text-xs"
                    >
                      <Settings2 className="h-3 w-3" />
                      配置
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(task)}
                      disabled={isToggling}
                      className="h-7 text-xs"
                    >
                      <Power className="h-3 w-3" />
                      {task.config.enabled ? '禁用' : '启用'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 全局开关说明 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">调度器说明</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                <li>定时任务在 ai-service 启动时自动挂载,每 60 秒轮询一次。</li>
                <li>所有任务默认 dry-run 模式,不会真的推送微信草稿箱,需手动触发或在配置中关闭 dry-run。</li>
                <li>任务执行历史保留最近 30 条(内存),服务重启后清空。</li>
                <li>时区:东八区(Asia/Shanghai)。</li>
                <li>
                  服务重启后,任务开关会重置为环境变量 <code>SELF_MEDIA_CRON_ENABLED</code>(默认
                  false)的值;运行时通过本页面启用的状态不会持久化到磁盘。
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 执行历史 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            {t('historyTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {history.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">{t('historyEmpty')}</p>
          ) : (
            <div role="list" className="space-y-1">
              {history.map((h, idx) => {
                const taskName =
                  tasks.find((t) => t.id === h.task_id)?.name ?? h.task_id
                return (
                  <div
                    key={`${h.task_id}-${idx}-${h.triggered_at}`}
                    role="listitem"
                    className="rounded-md px-2.5 py-2 text-xs transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        {h.status === 'success' ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
                        ) : h.status === 'failed' ? (
                          <XCircle className="h-3 w-3 shrink-0 text-rose-600" />
                        ) : (
                          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                        )}
                        <span className="truncate font-medium">{taskName}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                        <span>{formatDate(h.triggered_at)}</span>
                        <span>·</span>
                        <span>{formatDuration(h.duration_ms)}</span>
                      </div>
                    </div>
                    {h.error && (
                      <pre className="thin-scroll mt-1 max-h-20 overflow-auto rounded bg-rose-50 p-1.5 text-[10px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                        {h.error}
                      </pre>
                    )}
                    {h.status === 'success' && h.extra && Object.keys(h.extra).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                        {Object.entries(h.extra).slice(0, 5).map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded bg-muted px-1.5 py-0.5 font-mono"
                          >
                            {k}: {String(v).slice(0, 40)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
