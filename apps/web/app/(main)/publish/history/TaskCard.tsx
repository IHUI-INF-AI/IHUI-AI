// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 任务卡片(从 history/page.tsx 抽出)
 *
 * 单个发布任务卡,可折叠。展开后显示子 target 列表 + TaskProgressBar。
 *
 * AGENTS.md §4:rounded-md(禁 rounded-full)/ 无分割线 / 无渐变遮罩
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp, ExternalLink, Loader2 } from 'lucide-react'
import { Button, Card, CardContent, Input } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { PLATFORM_KEY } from '../helpers'
import { TaskProgressBar } from '@/components/publish/TaskProgressBar'
import { buildConfirmBody, toLocalDateTimeInputValue } from './confirm-helpers'
import { formatScheduledDistance } from './schedule-helpers'

interface Target {
  readonly platform: string
  readonly accountId?: number
  readonly status?: string
  readonly url?: string | null
  readonly error?: string | null
  readonly durationMs?: number
}

/** 单平台真实执行结果(GET /tasks 列表 platforms 字段) */
interface PlatformResult {
  readonly platform: string
  readonly success: boolean
  readonly publishedUrl?: string | null
  readonly platformContentId?: string | null
  readonly errorMessage?: string | null
  readonly durationMs?: number
}

export interface TaskCardProps {
  readonly task: {
    readonly id: number
    readonly taskId?: string
    readonly title: string
    readonly status: string
    readonly createdAt?: string
    readonly scheduledAt?: string | null
    readonly platformCount?: number
    readonly format?: string
    readonly targets?: ReadonlyArray<Target>
    readonly platforms?: ReadonlyArray<PlatformResult>
    readonly error?: string | null
  }
  readonly expanded: boolean
  readonly onToggle: (id: number) => void
  /** 取消/重试等操作成功后回调(父级用它刷新列表) */
  readonly onChanged?: () => void
}

interface DraftDetail {
  readonly title?: string | null
  readonly format?: string | null
  readonly content?: {
    readonly text?: string | null
    readonly file_path?: string | null
  }
}

const STATUS_LABEL: Record<string, string> = {
  success: '成功',
  failed: '失败',
  pending: '待处理',
  draft: '草稿',
  running: '运行中',
  skipped: '跳过',
}

const STATUS_STYLE: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  pending: 'bg-muted text-muted-foreground',
  draft: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
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

const TERMINAL_STATUSES = new Set(['success', 'failed', 'skipped'])

function fmtDuration(ms?: number): string {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

export function TaskCard({ task, expanded, onToggle, onChanged }: TaskCardProps) {
  const t = useTranslations('publish')
  const toast = useToast()
  const [acting, setActing] = React.useState<
    'cancel' | 'retry' | 'confirm' | 'reschedule' | null
  >(null)
  const [confirmMode, setConfirmMode] = React.useState<'now' | 'later'>('now')
  const [confirmAt, setConfirmAt] = React.useState('')
  const [confirmError, setConfirmError] = React.useState<string | null>(null)
  const [rescheduling, setRescheduling] = React.useState(false)
  const [rescheduleAt, setRescheduleAt] = React.useState('')
  const [rescheduleError, setRescheduleError] = React.useState<string | null>(null)
  const [draftPreview, setDraftPreview] = React.useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState(task.title)
  const [editText, setEditText] = React.useState('')
  const [editError, setEditError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const statusKey = task.status in STATUS_STYLE ? task.status : 'pending'
  const targets = task.targets ?? []
  const platforms = task.platforms ?? []
  const editTextEnabled = task.format === 'md' || task.format === 'html' || !task.format
  // 草稿展开时拉一次详情,让确认前能看到正文;不展开不请求。
  React.useEffect(() => {
    if (!expanded || task.status !== 'draft' || !task.taskId) return
    let cancelled = false
    setPreviewLoading(true)
    void fetchApi<DraftDetail>(`/api/publish/tasks/${task.taskId}`)
      .then((r) => {
        if (cancelled || !r.success) return
        const text = r.data?.content?.text?.trim()
        const file = r.data?.content?.file_path
        setDraftPreview(text || (file ? `文件: ${file}` : null))
        setEditTitle(r.data?.title?.trim() || task.title)
        setEditText(text ?? '')
      })
      .catch(() => {
        if (!cancelled) setDraftPreview(null)
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [expanded, task.status, task.taskId, task.title])

  React.useEffect(() => {
    if (!expanded) {
      setEditing(false)
      setEditError(null)
      setRescheduling(false)
      setRescheduleError(null)
    }
  }, [expanded])
  // 2026-08-17:有真实单平台结果(platforms)时优先用它统计/渲染,否则回退 targets
  const usePlatforms = platforms.length > 0
  const completed = usePlatforms
    ? platforms.filter((p) => p.success).length
    : targets.filter((tg) => TERMINAL_STATUSES.has(tg.status ?? '')).length
  const failed = usePlatforms
    ? platforms.filter((p) => !p.success).length
    : targets.filter((tg) => tg.status === 'failed').length
  const total = usePlatforms ? platforms.length : targets.length
  const running = task.status === 'running' || task.status === 'pending'
  const canCancel =
    task.status === 'running' || task.status === 'pending' || task.status === 'scheduled'
  const canReschedule = task.status === 'scheduled' || task.status === 'pending'
  const canRetry = task.status === 'failed' || task.status === 'partial'
  const canConfirm = task.status === 'draft'

  async function handleAction(action: 'cancel' | 'retry') {
    if (!task.taskId) return
    if (action === 'cancel' && !window.confirm(t('history.cancelPrompt'))) return
    setActing(action)
    const label = action === 'cancel' ? t('history.cancel') : t('history.retry')
    try {
      const r = await fetchApi<unknown>(`/api/publish/tasks/${task.taskId}/${action}`, {
        method: 'POST',
      })
      if (!r.success) {
        toast.error(r.error || label)
        return
      }
      toast.success(action === 'cancel' ? t('history.cancelled') : label)
      onChanged?.()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setActing(null)
    }
  }

  async function handleConfirm() {
    if (!task.taskId) return
    const built = buildConfirmBody({ mode: confirmMode, localDateTime: confirmAt })
    if (!built.ok) {
      setConfirmError(
        built.errorCode === 'MISSING_TIME'
          ? t('history.confirmTimeRequired')
          : built.errorCode === 'INVALID_TIME'
            ? t('history.confirmTimeInvalid')
            : t('history.confirmTimePast'),
      )
      return
    }
    setConfirmError(null)
    const prompt =
      confirmMode === 'later'
        ? t('history.confirmLaterPrompt', { time: confirmAt.replace('T', ' ') })
        : t('history.confirmPrompt')
    if (!window.confirm(prompt)) return

    setActing('confirm')
    try {
      const r = await fetchApi<unknown>(`/api/publish/tasks/${task.taskId}/confirm`, {
        method: 'POST',
        body: JSON.stringify(built.body),
      })
      if (!r.success) {
        toast.error(r.error || t('history.confirm'))
        return
      }
      toast.success(
        confirmMode === 'later' ? t('history.confirmScheduled') : t('history.confirmed'),
      )
      onChanged?.()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setActing(null)
    }
  }

  function openReschedule() {
    const base = task.scheduledAt ? new Date(task.scheduledAt) : new Date(Date.now() + 60 * 60 * 1000)
    setRescheduleAt(toLocalDateTimeInputValue(base))
    setRescheduleError(null)
    setRescheduling(true)
  }

  async function handleReschedule() {
    if (!task.taskId) return
    const built = buildConfirmBody({ mode: 'later', localDateTime: rescheduleAt })
    if (!built.ok) {
      setRescheduleError(
        built.errorCode === 'MISSING_TIME'
          ? t('history.confirmTimeRequired')
          : built.errorCode === 'INVALID_TIME'
            ? t('history.confirmTimeInvalid')
            : t('history.confirmTimePast'),
      )
      return
    }
    setRescheduleError(null)
    setActing('reschedule')
    try {
      const r = await fetchApi<unknown>(`/api/publish/tasks/${task.taskId}/reschedule`, {
        method: 'POST',
        body: JSON.stringify(built.body),
      })
      if (!r.success) {
        setRescheduleError(r.error || t('history.confirmTimeInvalid'))
        return
      }
      toast.success(t('history.rescheduled', { time: rescheduleAt.replace('T', ' ') }))
      setRescheduling(false)
      onChanged?.()
    } catch (e) {
      setRescheduleError((e as Error).message)
    } finally {
      setActing(null)
    }
  }

  async function handleSaveDraft() {
    if (!task.taskId || saving) return
    const nextTitle = editTitle.trim()
    if (!nextTitle) {
      setEditError(t('history.titleRequired'))
      return
    }
    setSaving(true)
    setEditError(null)
    try {
      const payload: { title: string; text?: string } = { title: nextTitle }
      if (editTextEnabled) payload.text = editText
      const r = await fetchApi<unknown>(`/api/publish/tasks/${task.taskId}/draft`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      if (!r.success) {
        setEditError(r.error || t('history.saveFailed'))
        return
      }
      if (editTextEnabled) setDraftPreview(editText.trim() || null)
      setEditTitle(nextTitle)
      setEditing(false)
      toast.success(t('history.saved'))
      onChanged?.()
    } catch (e) {
      setEditError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="min-[640px]:p-3 p-3">
        <button
          type="button"
          onClick={() => onToggle(task.id)}
          className="flex w-full items-center gap-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-body font-medium">{task.title}</span>
              <span
                className={cn(
                  'shrink-0 rounded-md px-2 py-0.5 text-label font-medium',
                  STATUS_STYLE[statusKey],
                )}
              >
                {STATUS_LABEL[task.status] ?? task.status}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-label text-muted-foreground">
              <span>
                {t('history.time')}:{' '}
                {task.createdAt ? TIME_FMT.format(new Date(task.createdAt)) : '-'}
              </span>
              {typeof task.platformCount === 'number' && <span>平台数: {task.platformCount}</span>}
              {task.scheduledAt && (
                <span>
                  {t('history.scheduledAt')}: {TIME_FMT.format(new Date(task.scheduledAt))}
                  {task.status === 'scheduled' && (
                    <span className="ml-1 text-amber-700 dark:text-amber-400">
                      {formatScheduledDistance(task.scheduledAt)}
                    </span>
                  )}
                </span>
              )}
              {task.format && <span className="font-mono">{task.format}</span>}
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0" />
          )}
        </button>

        {expanded && (
          <div className="mt-3 space-y-2 rounded-md bg-muted/40 p-3 text-label">
            {total > 0 && (
              <>
                <TaskProgressBar
                  completed={completed}
                  total={total}
                  failed={failed}
                  running={running}
                />
                <div className="space-y-1">
                  {usePlatforms
                    ? platforms.map((p, i) => (
                        <div
                          key={`${p.platform}-${i}`}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span className="font-medium">
                            {t(PLATFORM_KEY[p.platform] ?? 'platforms.unknown')}
                          </span>
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px]',
                              p.success ? STATUS_STYLE.success : STATUS_STYLE.failed,
                            )}
                          >
                            {p.success ? STATUS_LABEL.success : STATUS_LABEL.failed}
                          </span>
                          {p.durationMs !== undefined && p.durationMs !== null && (
                            <span className="text-muted-foreground">
                              {fmtDuration(p.durationMs)}
                            </span>
                          )}
                          {p.publishedUrl && (
                            <a
                              href={p.publishedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {t('history.openUrl')}
                            </a>
                          )}
                          {p.errorMessage && (
                            <span className="text-rose-600 dark:text-rose-400">
                              {p.errorMessage}
                            </span>
                          )}
                        </div>
                      ))
                    : targets.map((tg, i) => (
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
              </>
            )}
            {task.status === 'draft' && (
              <div className="space-y-1">
                <div className="text-muted-foreground">{t('history.draftPreview')}</div>
                {previewLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : (
                  <pre className="thin-scroll max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-[10px]">
                    {draftPreview || t('history.draftNoText')}
                  </pre>
                )}
              </div>
            )}
            {task.status === 'draft' && editing && (
              <div className="space-y-2 rounded-md border border-input bg-background p-3">
                <label
                  className="block text-label text-muted-foreground"
                  htmlFor={`draft-title-${task.id}`}
                >
                  {t('history.editTitle')}
                </label>
                <Input
                  id={`draft-title-${task.id}`}
                  value={editTitle}
                  maxLength={500}
                  disabled={saving}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                {editTextEnabled ? (
                  <>
                    <label
                      className="block text-label text-muted-foreground"
                      htmlFor={`draft-text-${task.id}`}
                    >
                      {t('history.editText')}
                    </label>
                    <textarea
                      id={`draft-text-${task.id}`}
                      value={editText}
                      disabled={saving}
                      rows={5}
                      onChange={(e) => setEditText(e.target.value)}
                      className="thin-scroll flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-body shadow-elevation-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-stroke-focus"
                    />
                  </>
                ) : (
                  <p className="text-label text-muted-foreground">{t('history.fileEditHint')}</p>
                )}
                {editError && (
                  <p role="alert" className="text-label text-rose-600 dark:text-rose-400">
                    {editError}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Button size="sm" disabled={saving} onClick={() => void handleSaveDraft()}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {saving ? t('history.saving') : t('history.saveDraft')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      setEditing(false)
                      setEditError(null)
                    }}
                  >
                    {t('history.cancelEdit')}
                  </Button>
                </div>
              </div>
            )}
            {task.error && (
              <pre className="thin-scroll max-h-32 overflow-auto rounded bg-rose-50 p-2 text-[10px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {task.error}
              </pre>
            )}
            {canReschedule && rescheduling && (
              <div className="space-y-2 rounded-md border border-input bg-background p-3">
                <label className="flex flex-wrap items-center gap-2" htmlFor={`reschedule-${task.id}`}>
                  <span className="text-label text-muted-foreground">{t('history.rescheduleAt')}</span>
                  <input
                    id={`reschedule-${task.id}`}
                    type="datetime-local"
                    value={rescheduleAt}
                    min={toLocalDateTimeInputValue(new Date(Date.now() + 60_000))}
                    disabled={acting === 'reschedule'}
                    onChange={(e) => {
                      setRescheduleAt(e.target.value)
                      setRescheduleError(null)
                    }}
                    className="rounded-md border border-input bg-transparent px-2 py-1 text-body"
                  />
                </label>
                {rescheduleError && (
                  <p role="alert" className="text-label text-rose-600 dark:text-rose-400">
                    {rescheduleError}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={!task.taskId || acting !== null}
                    onClick={() => void handleReschedule()}
                  >
                    {acting === 'reschedule' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                    {t('history.rescheduleSave')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting !== null}
                    onClick={() => {
                      setRescheduling(false)
                      setRescheduleError(null)
                    }}
                  >
                    {t('history.cancelEdit')}
                  </Button>
                </div>
              </div>
            )}
            {canConfirm && !editing && (
              <div className="space-y-2 rounded-md border border-input bg-background p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">{t('history.confirmWhen')}</span>
                  <button
                    type="button"
                    aria-pressed={confirmMode === 'now'}
                    onClick={() => {
                      setConfirmMode('now')
                      setConfirmError(null)
                    }}
                    className={
                      confirmMode === 'now'
                        ? 'rounded-md border border-primary bg-primary/10 px-2 py-1 text-primary'
                        : 'rounded-md border px-2 py-1 text-muted-foreground hover:bg-muted/40'
                    }
                  >
                    {t('history.confirmNow')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={confirmMode === 'later'}
                    onClick={() => {
                      setConfirmMode('later')
                      setConfirmError(null)
                    }}
                    className={
                      confirmMode === 'later'
                        ? 'rounded-md border border-primary bg-primary/10 px-2 py-1 text-primary'
                        : 'rounded-md border px-2 py-1 text-muted-foreground hover:bg-muted/40'
                    }
                  >
                    {t('history.confirmLater')}
                  </button>
                  {confirmMode === 'later' && (
                    <label className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">{t('history.confirmAt')}</span>
                      <input
                        type="datetime-local"
                        value={confirmAt}
                        min={toLocalDateTimeInputValue(new Date(Date.now() + 60_000))}
                        onChange={(e) => {
                          setConfirmAt(e.target.value)
                          setConfirmError(null)
                        }}
                        className="rounded-md border border-input bg-transparent px-2 py-1 text-body"
                      />
                    </label>
                  )}
                </div>
                {confirmError && (
                  <p role="alert" className="text-label text-rose-600 dark:text-rose-400">
                    {confirmError}
                  </p>
                )}
              </div>
            )}
            {(canCancel || canRetry || canConfirm || canReschedule) && (
              <div className="flex items-center gap-2 pt-1">
                {canConfirm && !editing && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!task.taskId || acting !== null || saving}
                    onClick={() => {
                      setEditing(true)
                      setEditError(null)
                    }}
                  >
                    {t('history.editDraft')}
                  </Button>
                )}
                {canConfirm && (
                  <Button
                    size="sm"
                    disabled={!task.taskId || acting !== null}
                    onClick={() => void handleConfirm()}
                  >
                    {acting === 'confirm' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Loader2 className="h-3 w-3 opacity-0" />
                    )}
                    {confirmMode === 'later' ? t('history.confirmLater') : t('history.confirm')}
                  </Button>
                )}
                {canReschedule && !rescheduling && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!task.taskId || acting !== null}
                    onClick={openReschedule}
                  >
                    {t('history.reschedule')}
                  </Button>
                )}
                {canCancel && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!task.taskId || acting !== null}
                    onClick={() => void handleAction('cancel')}
                  >
                    {acting === 'cancel' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Loader2 className="h-3 w-3 opacity-0" />
                    )}
                    {t('history.cancel')}
                  </Button>
                )}
                {canRetry && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!task.taskId || acting !== null}
                    onClick={() => void handleAction('retry')}
                  >
                    {acting === 'retry' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Loader2 className="h-3 w-3 opacity-0" />
                    )}
                    {t('history.retry')}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
