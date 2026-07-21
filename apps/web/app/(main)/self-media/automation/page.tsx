'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Clock,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  History,
  Settings2,
  Power,
  Video,
  Bell,
  BarChart3,
  Eye,
  Mail,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Switch } from '@ihui/ui'
import { useToast } from '@/hooks/use-toast'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useChat } from '@/hooks/use-chat'

/** 自动化工作示例模板(2026-07-22 新增,展示 6 个典型场景) */
interface AutomationExample {
  id: string
  icon: LucideIcon
  nameKey: string
  descKey: string
  scheduleKey: string
  outputKey: string
}

const AUTOMATION_EXAMPLES: AutomationExample[] = [
  {
    id: 'wechat-daily',
    icon: Clock,
    nameKey: 'example1Name',
    descKey: 'example1Desc',
    scheduleKey: 'example1Schedule',
    outputKey: 'example1Output',
  },
  {
    id: 'video-script',
    icon: Video,
    nameKey: 'example2Name',
    descKey: 'example2Desc',
    scheduleKey: 'example2Schedule',
    outputKey: 'example2Output',
  },
  {
    id: 'content-monitor',
    icon: Bell,
    nameKey: 'example3Name',
    descKey: 'example3Desc',
    scheduleKey: 'example3Schedule',
    outputKey: 'example3Output',
  },
  {
    id: 'data-report',
    icon: BarChart3,
    nameKey: 'example4Name',
    descKey: 'example4Desc',
    scheduleKey: 'example4Schedule',
    outputKey: 'example4Output',
  },
  {
    id: 'competitor-track',
    icon: Eye,
    nameKey: 'example5Name',
    descKey: 'example5Desc',
    scheduleKey: 'example5Schedule',
    outputKey: 'example5Output',
  },
  {
    id: 'email-daily',
    icon: Mail,
    nameKey: 'example6Name',
    descKey: 'example6Desc',
    scheduleKey: 'example6Schedule',
    outputKey: 'example6Output',
  },
]

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
  const locale = useLocale()
  const toast = useToast()
  const tasksRef = React.useRef<HTMLDivElement>(null)
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

  /** 点击示例卡片:打开 AI 对话面板注入"创建 XXX 自动化任务"消息(2026-07-22 升级)
   *  原方案只 toast + 滚动,无实际填充。现改为对接 AI 对话面板:
   *  - 打开 AI 对话面板
   *  - 注入按 exampleId 定制的创建指令(name + desc + schedule + output)
   *  - AI 引导用户完成自动化任务配置(比手动填表单更智能) */
  const openAiPanel = useAiPanelStore((s) => s.openPanel)
  const { sendMessage } = useChat()
  const handleUseExample = (ex: AutomationExample) => {
    openAiPanel()
    const name = t(ex.nameKey)
    const desc = t(ex.descKey)
    const schedule = t(ex.scheduleKey)
    const output = t(ex.outputKey)
    const prompt = t('exampleInvokePrompt', { name, desc, schedule, output })
    void sendMessage(prompt)
    toast.info(t('templateLoaded', { name }))
  }

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
      return new Intl.DateTimeFormat(locale, {
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
      return new Intl.DateTimeFormat(locale, {
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
      {/* 自动化示例模板(2026-07-22 新增,6 个典型场景,点击参考快速配置) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            {t('examplesTitle')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t('examplesDesc')}</p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AUTOMATION_EXAMPLES.map((ex) => {
              const ExIcon = ex.icon
              return (
                <div
                  key={ex.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                      <ExIcon className="h-4 w-4" />
                    </div>
                    <h4 className="text-sm font-semibold leading-tight">{t(ex.nameKey)}</h4>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{t(ex.descKey)}</p>
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{t(ex.scheduleKey)}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-2">{t(ex.outputKey)}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleUseExample(ex)}
                    className="mt-auto h-7 text-xs"
                  >
                    {t('useRefTemplate')}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 任务列表 */}
      <div ref={tasksRef} className="grid gap-4 md:grid-cols-2 scroll-mt-4">
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
                        {t('running')}
                      </span>
                    )}
                    <Switch
                      checked={task.config.enabled}
                      onCheckedChange={() => handleToggle(task)}
                      disabled={isToggling}
                      aria-label={t('toggleAriaLabel')}
                    />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                {/* 当前配置展示 */}
                {!isEditing && (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="text-muted-foreground">{t('executionTime')}</span>
                      <code className="font-mono">
                        {String(task.config.hour).padStart(2, '0')}:
                        {String(task.config.minute).padStart(2, '0')}
                      </code>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="text-muted-foreground">{t('runMode')}</span>
                      <span>
                        {task.config.dryRun ? (
                          <span className="text-amber-600">{t('modeDryRun')}</span>
                        ) : (
                          <span className="text-emerald-600">{t('modeProduction')}</span>
                        )}
                      </span>
                    </div>
                    {task.id === 'wechat_daily' && (
                      <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                        <span className="text-muted-foreground">{t('titleTemplate')}</span>
                        <code className="max-w-[60%] truncate font-mono">
                          {task.config.titleTemplate || t('notConfigured')}
                        </code>
                      </div>
                    )}
                    <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="text-muted-foreground">{t('status')}</span>
                      <span
                        className={
                          task.config.enabled
                            ? 'font-medium text-emerald-600'
                            : 'text-muted-foreground'
                        }
                      >
                        {task.config.enabled ? t('enabled') : t('disabled')}
                      </span>
                    </div>
                    {task.lastRun && (
                      <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                        <span className="text-muted-foreground">{t('lastRun')}</span>
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
                          {t('hourLabel')}
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
                          {t('minuteLabel')}
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
                        {t('dryRunLabel')}
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
                          {t('titleTemplateLabel')}
                        </Label>
                        <Input
                          id={`title-${task.id}`}
                          value={editTitleTpl}
                          onChange={(e) => setEditTitleTpl(e.target.value)}
                          placeholder={t('titleTemplatePlaceholder')}
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
                        {t('cancel')}
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
                        {t('save')}
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
                      {t('triggerNow')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(task)}
                      className="h-7 text-xs"
                    >
                      <Settings2 className="h-3 w-3" />
                      {t('configure')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(task)}
                      disabled={isToggling}
                      className="h-7 text-xs"
                    >
                      <Power className="h-3 w-3" />
                      {task.config.enabled ? t('disable') : t('enable')}
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
              <p className="font-semibold">{t('schedulerNoteTitle')}</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                <li>{t('note1')}</li>
                <li>{t('note2')}</li>
                <li>{t('note3')}</li>
                <li>{t('note4')}</li>
                <li>
                  {t.rich('note5', {
                    code: (chunks) => <code>{chunks}</code>,
                  })}
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
