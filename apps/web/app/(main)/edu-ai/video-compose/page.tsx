'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Clock,
  FileText,
  Film,
  Images,
  Loader2,
  RefreshCw,
  Subtitles,
  XCircle,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Card, CardContent, Input, Label } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton, Empty } from '@/components/common'

type ComposeStepName = 'script' | 'material' | 'compose' | 'subtitle'
type ComposeStepStatus = 'pending' | 'running' | 'succeeded' | 'failed'

interface ComposeStep {
  name: ComposeStepName
  status: ComposeStepStatus
  result?: unknown
  error?: string
  startedAt?: number
  finishedAt?: number
}

interface ComposeTask {
  id: string
  userId: string
  prompt: string
  model?: string
  status: ComposeStepStatus
  steps: Record<ComposeStepName, ComposeStep>
  createdAt: number
  updatedAt: number
}

const STEP_KEYS: ComposeStepName[] = ['script', 'material', 'compose', 'subtitle']

const STATUS_LABEL_KEY: Record<ComposeStepStatus, string> = {
  pending: 'statusPending',
  running: 'statusRunning',
  succeeded: 'statusSucceeded',
  failed: 'statusFailed',
}

const STATUS_BADGE: Record<ComposeStepStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-sky-500/10 text-sky-600',
  succeeded: 'bg-emerald-500/10 text-emerald-600',
  failed: 'bg-rose-500/10 text-rose-600',
}

const STATUS_NODE: Record<ComposeStepStatus, string> = {
  pending: 'border-border bg-muted text-muted-foreground',
  running: 'border-sky-500/30 bg-sky-500/10 text-sky-600',
  succeeded: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
  failed: 'border-rose-500/30 bg-rose-500/10 text-rose-600',
}

const STATUS_ICON: Record<ComposeStepStatus, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  running: Loader2,
  succeeded: CheckCircle2,
  failed: XCircle,
}

const STEP_ICON: Record<ComposeStepName, React.ComponentType<{ className?: string }>> = {
  script: FileText,
  material: Images,
  compose: Film,
  subtitle: Subtitles,
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetchApi<T>(url, options)
  if (!res.success) throw new Error(res.error)
  return res.data
}

function isUrl(value: string): boolean {
  return /^https?:\/\/\S+$/.test(value)
}

/** 从步骤 result 提取文本内容(脚本/字幕的 chat 补全结果) */
function extractText(result: unknown): string | null {
  if (typeof result === 'string') return result
  if (!result || typeof result !== 'object') return null
  const obj = result as Record<string, unknown>
  if (typeof obj.content === 'string' && obj.content) return obj.content
  const choices = obj.choices
  if (Array.isArray(choices)) {
    const first = choices[0] as Record<string, unknown> | undefined
    const message = first?.message as Record<string, unknown> | undefined
    if (typeof message?.content === 'string' && message.content) return message.content
  }
  return null
}

/** 深度遍历 result 收集其中的 URL(素材图/合成视频链接),媒体类字段优先 */
function extractUrls(result: unknown): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  const push = (value: unknown): void => {
    if (typeof value === 'string' && isUrl(value) && !seen.has(value)) {
      seen.add(value)
      urls.push(value)
    }
  }
  const walk = (node: unknown, depth: number): void => {
    if (depth > 8 || node === null || node === undefined) return
    if (typeof node === 'string') {
      push(node)
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }
    if (typeof node !== 'object') return
    const record = node as Record<string, unknown>
    for (const key of ['video_url', 'url', 'cover_url', 'thumbnail_url']) {
      push(record[key])
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') walk(value, depth + 1)
    }
  }
  walk(result, 0)
  return urls
}

/** 步骤耗时(秒);startedAt/finishedAt 齐全时才返回 */
function stepElapsedSeconds(step: ComposeStep): number | null {
  if (typeof step.startedAt === 'number' && typeof step.finishedAt === 'number') {
    return Math.max(0, Math.round((step.finishedAt - step.startedAt) / 1000))
  }
  return null
}

function StepResultView({ step }: { step: ComposeStep }) {
  const t = useTranslations('eduAi.video')
  const titleKey = `${step.name}Result`

  // material:素材 URL 列表;compose:合成视频 URL(优先)
  if (step.name === 'material' || step.name === 'compose') {
    const urls = extractUrls(step.result)
    if (urls.length > 0) {
      return (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t(titleKey)}</p>
          {step.name === 'compose' ? (
            /* eslint-disable-next-line jsx-a11y/media-has-caption -- AI 合成视频，无可用字幕 */
            <video src={urls[0]} controls className="max-h-64 w-full rounded-md bg-black" />
          ) : null}
          <ul className="space-y-1">
            {urls.map((url, i) => (
              <li key={`${i}-${url}`}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-xs text-primary hover:underline"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )
    }
  }

  const text = extractText(step.result)
  if (text) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">{t(titleKey)}</p>
        <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">{text}</pre>
      </div>
    )
  }

  return (
    <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
      {typeof step.result === 'string' ? step.result : JSON.stringify(step.result, null, 2)}
    </pre>
  )
}

export default function EduAiVideoComposePage() {
  const t = useTranslations('eduAi.video')

  const [prompt, setPrompt] = React.useState('')
  const [model, setModel] = React.useState('')
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [tasks, setTasks] = React.useState<ComposeTask[]>([])
  const [viewTaskId, setViewTaskId] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [regenerating, setRegenerating] = React.useState<{
    taskId: string
    step: ComposeStepName
  } | null>(null)
  const [regenerateError, setRegenerateError] = React.useState<string | null>(null)

  const viewTask =
    (viewTaskId ? tasks.find((task) => task.id === viewTaskId) : undefined) ?? tasks[0] ?? null

  // 轮询:存在 pending/running 任务时每 3s 拉取最新状态,直到进入终态
  const activeTask =
    tasks.find((task) => task.status === 'pending' || task.status === 'running') ?? null

  React.useEffect(() => {
    if (!activeTask) return
    let disposed = false
    let inFlight = false
    const refresh = async (): Promise<void> => {
      if (inFlight || disposed) return
      inFlight = true
      try {
        const latest = await api<ComposeTask>(`/api/ai-video-compose/${activeTask.id}`)
        if (disposed) return
        setTasks((prev) => prev.map((task) => (task.id === latest.id ? latest : task)))
      } catch {
        // 轮询失败静默跳过,下一周期重试
      } finally {
        inFlight = false
      }
    }
    void refresh()
    const timer = setInterval(() => {
      void refresh()
    }, 3000)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [activeTask])

  const handleCreate = async (): Promise<void> => {
    const content = prompt.trim()
    if (!content || creating) return
    setCreating(true)
    setCreateError(null)
    try {
      const task = await api<ComposeTask>('/api/ai-video-compose', {
        method: 'POST',
        body: JSON.stringify({ prompt: content, model: model.trim() || undefined }),
      })
      setTasks((prev) => [task, ...prev])
      setViewTaskId(task.id)
      setPrompt('')
    } catch (e) {
      setCreateError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const handleRegenerate = async (taskId: string, step: ComposeStepName): Promise<void> => {
    if (regenerating) return
    setRegenerating({ taskId, step })
    setRegenerateError(null)
    try {
      const task = await api<ComposeTask>(`/api/ai-video-compose/${taskId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ step }),
      })
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)))
      setViewTaskId(task.id)
    } catch (e) {
      setRegenerateError((e as Error).message)
    } finally {
      setRegenerating(null)
    }
  }

  const toggleExpand = (taskId: string, step: ComposeStepName): void => {
    const key = `${taskId}:${step}`
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const failedStep = viewTask
    ? STEP_KEYS.map((key) => viewTask.steps[key]).find((step) => step.status === 'failed')
    : undefined

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/edu" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Clapperboard className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 创建区 */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="video-prompt">{t('promptLabel')}</Label>
            <textarea
              id="video-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('promptPlaceholder')}
              maxLength={300}
              rows={4}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-right text-xs text-muted-foreground">{prompt.length}/300</p>
          </div>

          <div className="flex flex-col gap-3 min-[480px]:flex-row">
            <div className="min-w-0 flex-1">
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={t('modelPlaceholder')}
                className="h-9"
                aria-label={t('modelPlaceholder')}
              />
            </div>
            <Button
              onClick={() => {
                void handleCreate()
              }}
              disabled={!prompt.trim() || creating}
              className="gap-1.5"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Clapperboard className="h-4 w-4" />
              )}
              {creating ? t('creating') : t('createBtn')}
            </Button>
          </div>

          {createError && (
            <Alert
              variant="danger"
              title={t('error')}
              description={createError}
              closable
              onClose={() => setCreateError(null)}
            />
          )}
        </CardContent>
      </Card>

      {/* 流程展示 */}
      {viewTask && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{viewTask.prompt}</p>
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-xs',
                  STATUS_BADGE[viewTask.status],
                )}
              >
                {t(STATUS_LABEL_KEY[viewTask.status])}
              </span>
            </div>
            <p className="mb-3 break-all text-xs text-muted-foreground">
              {t('taskId')}: {viewTask.id}
            </p>

            <ol>
              {STEP_KEYS.map((stepKey, index) => {
                const step = viewTask.steps[stepKey]
                const isLast = index === STEP_KEYS.length - 1
                const StepIcon = STEP_ICON[stepKey]
                const StatusIcon = STATUS_ICON[step.status]
                const elapsed = stepElapsedSeconds(step)
                const expandKey = `${viewTask.id}:${stepKey}`
                const isExpanded = Boolean(expanded[expandKey])
                const isRegenerating =
                  regenerating?.taskId === viewTask.id && regenerating.step === stepKey
                return (
                  <li key={stepKey} className="relative flex gap-3 pb-4 last:pb-0">
                    {!isLast && (
                      <span
                        className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-border"
                        aria-hidden="true"
                      />
                    )}
                    <div
                      className={cn(
                        'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                        STATUS_NODE[step.status],
                      )}
                    >
                      <StatusIcon
                        className={cn('h-4 w-4', step.status === 'running' && 'animate-spin')}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <StepIcon className="h-4 w-4 text-muted-foreground" />
                          {t(`step${stepKey.charAt(0).toUpperCase()}${stepKey.slice(1)}`)}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-xs',
                            STATUS_BADGE[step.status],
                          )}
                        >
                          {t(STATUS_LABEL_KEY[step.status])}
                        </span>
                        {elapsed !== null && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {t('elapsed')}: {elapsed}s
                          </span>
                        )}
                      </div>

                      {step.status === 'succeeded' && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(viewTask.id, stepKey)}
                          className="mt-1 flex items-center gap-0.5 text-xs text-primary hover:underline"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          {t('detail')}
                        </button>
                      )}

                      {step.status === 'failed' && step.error && (
                        <p className="mt-1 break-words text-xs text-rose-600">{step.error}</p>
                      )}
                      {step.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 gap-1.5 px-2 text-xs"
                          disabled={Boolean(regenerating)}
                          onClick={() => {
                            void handleRegenerate(viewTask.id, stepKey)
                          }}
                        >
                          {isRegenerating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          {t('regenerate')}
                        </Button>
                      )}

                      {isExpanded && step.status === 'succeeded' && (
                        <div className="mt-2 rounded-md border bg-muted/40 p-3">
                          <StepResultView step={step} />
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>

            {regenerateError && (
              <Alert
                variant="danger"
                title={t('error')}
                description={regenerateError}
                closable
                onClose={() => setRegenerateError(null)}
                className="mt-3"
              />
            )}
            {viewTask.status === 'failed' && !regenerateError && (
              <Alert
                variant="danger"
                title={t('error')}
                description={failedStep?.error ?? t('error')}
                className="mt-3"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* 历史任务(会话态) */}
      <Card>
        <CardContent className="p-4">
          {tasks.length === 0 ? (
            <Empty icon={Clapperboard} title={t('noTasks')} />
          ) : (
            <ul className="divide-y">
              {tasks.map((task) => {
                const TaskStatusIcon = STATUS_ICON[task.status]
                const isViewing = viewTask?.id === task.id
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => setViewTaskId(task.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent',
                        isViewing && 'bg-accent',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                          STATUS_NODE[task.status],
                        )}
                      >
                        <TaskStatusIcon
                          className={cn(
                            'h-3.5 w-3.5',
                            task.status === 'running' && 'animate-spin',
                          )}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 block text-sm">{task.prompt}</span>
                        <span className="block text-xs text-muted-foreground">
                          {t('taskId')}: {task.id}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-md px-2 py-0.5 text-xs',
                          STATUS_BADGE[task.status],
                        )}
                      >
                        {t(STATUS_LABEL_KEY[task.status])}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
