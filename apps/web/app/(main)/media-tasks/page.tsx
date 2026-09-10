// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, RefreshCw, Clapperboard, XCircle, PlayCircle, ImageIcon, Mic, Film, Music, Download, ChevronLeft, ChevronRight, Trash2, Eraser, Ban, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui-react'

/** 对话内媒体任务统一中心(2026-09-09 立,2026-09-09 E5 增下载/分页/i18n)。
 *  展示 /api/media/tasks 落库的 video/music/tts/image 任务,
 *  支持按状态/类型过滤、产物播放/预览/下载、在途任务取消与刷新、分页。 */

interface MediaTaskResult {
  image_url?: string | null
  audio_url?: string | null
  video_url?: string | null
}

interface MediaTask {
  id: number
  kind: string
  tool: string
  provider: string
  task_id: string
  status: string
  message: string
  result?: MediaTaskResult
  created_at: string
  updated_at: string
}

interface MediaTaskStats {
  by_kind: Record<string, { total: number; succeeded: number; failed: number; cancelled: number; inflight: number }>
  total: number
  inflight: number
  succeeded: number
  failed: number
  cancelled: number
}

const PAGE_SIZE = 10

/** 在途状态集(2026-09-09 收尾修复):与后端 _STATUS_IN_FLIGHT 保持一致,
 *  轮询/取消按钮/状态过滤统一按此判断,不再只认 processing。 */
const STATUS_IN_FLIGHT: readonly string[] = ['processing', 'accepted', 'submitted', 'pending']

const isInFlight = (status: string): boolean => STATUS_IN_FLIGHT.includes(status)

const KIND_ICONS: Record<string, typeof Film> = {
  video: Film,
  music: Music,
  tts: Mic,
  image: ImageIcon,
}

const KIND_CLASS: Record<string, string> = {
  video: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  music: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  tts: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  image: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

const STATUS_CLASS: Record<string, string> = {
  processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  accepted: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  submitted: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  pending: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  succeeded: 'bg-green-500/10 text-green-600 dark:text-green-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  cancelled: 'bg-muted text-muted-foreground',
}

const STATUS_LABEL_KEY: Record<string, string> = {
  processing: 'statusBadgeProcessing',
  accepted: 'statusBadgeProcessing',
  submitted: 'statusBadgeProcessing',
  pending: 'statusBadgeProcessing',
  succeeded: 'statusBadgeSucceeded',
  failed: 'statusBadgeFailed',
  cancelled: 'statusBadgeCancelled',
}

function MediaTaskStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const labelKey = STATUS_LABEL_KEY[status]
  const label = labelKey ? t(labelKey) : status
  return (
    <span className={cn('inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium', STATUS_CLASS[status] ?? 'bg-muted text-muted-foreground')}>
      {label}
    </span>
  )
}

function MediaKindBadge({ kind, t }: { kind: string; t: (key: string) => string }) {
  const labelKey = `kind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`
  const label = t(labelKey) === labelKey ? kind : t(labelKey)
  const Icon = KIND_ICONS[kind] ?? PlayCircle
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium', KIND_CLASS[kind] ?? 'bg-muted text-muted-foreground')}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

function MediaResultPreview({ task }: { task: MediaTask }) {
  const urls = task.result ?? {}
  if (urls.video_url) {
    return (
      <video controls src={urls.video_url} preload="metadata" className="w-full max-w-md rounded-md border border-border">
        <track kind="captions" />
      </video>
    )
  }
  if (urls.audio_url) {
    return (
      <audio controls src={urls.audio_url} preload="metadata" className="w-full max-w-md">
        <track kind="captions" />
      </audio>
    )
  }
  if (urls.image_url) {
    // eslint-disable-next-line @next/next/no-img-element -- 动态远程图片降级用 img
    return <img src={urls.image_url} alt={task.message || 'media'} className="w-full max-w-md rounded-md border border-border" />
  }
  return null
}

function resultUrl(task: MediaTask): string | null {
  const urls = task.result ?? {}
  return urls.video_url || urls.audio_url || urls.image_url || null
}

async function api<T>(url: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error || 'Request failed')
  return r.data
}

export default function MediaTasksPage() {
  const t = useTranslations('mediaTasksPage')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = React.useState('')
  const [kindFilter, setKindFilter] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [cancelling, setCancelling] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState<string | null>(null)
  const [clearing, setClearing] = React.useState(false)
  const [cancellingAll, setCancellingAll] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [clearInfo, setClearInfo] = React.useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['media-tasks', statusFilter, kindFilter, page],
    queryFn: () =>
      api<{ ok: boolean; data: { items: MediaTask[]; total: number } }>(
        `/media/tasks?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}${statusFilter ? `&status=${statusFilter}` : ''}${kindFilter ? `&kind=${kindFilter}` : ''}`,
      ),
    refetchInterval: (q) => {
      const items = q.state.data?.data?.items ?? []
      return items.some((task) => isInFlight(task.status)) ? 5000 : false
    },
  })

  // 2026-09-09 F8:统计概览卡片(总数/在途/已完成/失败/已取消,按 kind 明细)。
  const statsQuery = useQuery({
    queryKey: ['media-tasks-stats'],
    queryFn: () => api<{ ok: boolean; data: MediaTaskStats }>('/media/tasks/stats'),
    refetchInterval: (q) => ((q.state.data?.data?.inflight ?? 0) > 0 ? 5000 : false),
  })

  const tasks = listQuery.data?.data?.items ?? []
  const total = listQuery.data?.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const stats = statsQuery.data?.data
  const inflightCount = stats?.inflight ?? 0

  const cancelTask = async (taskId: string) => {
    setCancelling(taskId)
    setError(null)
    try {
      const res = await api<{ ok: boolean; data?: { error?: string } }>(
        `/media/tasks/${encodeURIComponent(taskId)}/cancel`,
        { method: 'POST' },
      )
      if (res.data?.error) setError(`${t('cancel')}失败: ${res.data.error}`)
      await queryClient.invalidateQueries({ queryKey: ['media-tasks'] })
      await queryClient.invalidateQueries({ queryKey: ['media-tasks-stats'] })
    } catch (e) {
      setError(`${t('cancel')}失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setCancelling(null)
    }
  }

  const deleteTask = async (taskId: string) => {
    if (!window.confirm(t('deleteConfirm'))) return
    setDeleting(taskId)
    setError(null)
    try {
      await api<{ ok: boolean }>(
        `/media/tasks/${encodeURIComponent(taskId)}`,
        { method: 'DELETE' },
      )
      await queryClient.invalidateQueries({ queryKey: ['media-tasks'] })
      await queryClient.invalidateQueries({ queryKey: ['media-tasks-stats'] })
    } catch (e) {
      setError(`${t('delete')}失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setDeleting(null)
    }
  }

  const clearTasks = async () => {
    if (!window.confirm(t('clearConfirm'))) return
    setClearing(true)
    setError(null)
    setClearInfo(null)
    try {
      const res = await api<{ ok: boolean; data?: { deleted?: number; kept_in_flight?: number } }>(
        `/media/tasks?status=succeeded,failed,cancelled`,
        { method: 'DELETE' },
      )
      setClearInfo(t('clearResult', { deleted: res.data?.deleted ?? 0, kept: res.data?.kept_in_flight ?? 0 }))
      await queryClient.invalidateQueries({ queryKey: ['media-tasks'] })
      await queryClient.invalidateQueries({ queryKey: ['media-tasks-stats'] })
    } catch (e) {
      setError(`${t('clearDone')}失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setClearing(false)
    }
  }

  // 2026-09-09 F8:一键取消全部在途任务(已终态任务不受影响)。
  const cancelAllInflight = async () => {
    if (!window.confirm(t('cancelAllConfirm'))) return
    setCancellingAll(true)
    setError(null)
    setClearInfo(null)
    try {
      const res = await api<{ ok: boolean; data?: { requested?: number; cancelled?: number; remote_failed?: { task_id: string; error: string }[] } }>(
        '/media/tasks/cancel',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      )
      const n = res.data?.cancelled ?? 0
      // 2026-09-09 第五轮:F8 承诺 remote_failed 透出给用户(此前被静默丢弃)
      const remoteFailed = res.data?.remote_failed ?? []
      let msg = n > 0 ? t('cancelAllResult', { count: n }) : t('cancelAllNone')
      if (remoteFailed.length > 0) {
        msg += ` ${t('cancelAllRemoteFailed', { count: remoteFailed.length })}`
      }
      setClearInfo(msg)
      await queryClient.invalidateQueries({ queryKey: ['media-tasks'] })
      await queryClient.invalidateQueries({ queryKey: ['media-tasks-stats'] })
    } catch (e) {
      setError(`${t('cancelAll')}失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setCancellingAll(false)
    }
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const statusFilters = [
    { key: '', label: t('statusAll') },
    { key: STATUS_IN_FLIGHT.join(','), label: t('statusProcessing') },
    { key: 'succeeded', label: t('statusSucceeded') },
    { key: 'failed,cancelled', label: t('statusFailedCancelled') },
  ]

  const kindFilters = [
    { key: '', label: t('kindAll') },
    { key: 'video', label: t('kindVideo') },
    { key: 'music', label: t('kindMusic') },
    { key: 'tts', label: t('kindTts') },
    { key: 'image', label: t('kindImage') },
  ]

  const switchFilter = (setter: (v: string) => void) => (v: string) => {
    setter(v)
    setPage(1)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Clapperboard className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={cancellingAll || inflightCount === 0}
            onClick={cancelAllInflight}
          >
            <Ban className={cn('mr-1 h-4 w-4', cancellingAll && 'animate-pulse')} />
            {cancellingAll ? t('cancellingAll') : t('cancelAll')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={clearing || total === 0}
            onClick={clearTasks}
          >
            <Eraser className={cn('mr-1 h-4 w-4', clearing && 'animate-pulse')} />
            {clearing ? t('clearing') : t('clearDone')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              listQuery.refetch()
              statsQuery.refetch()
            }}
            disabled={listQuery.isFetching || statsQuery.isFetching}
          >
            <RefreshCw className={cn('mr-1 h-4 w-4', (listQuery.isFetching || statsQuery.isFetching) && 'animate-spin')} />
            {t('refresh')}
          </Button>
        </div>
      </header>

      {/* 2026-09-09 F8:统计概览卡片(总数/在途/已完成/失败/已取消);第五轮:卡片可点击直达对应状态过滤 */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          [
            { key: 'total', label: t('statsTotal'), value: stats?.total ?? 0, cls: 'text-foreground', filter: '' },
            { key: 'inflight', label: t('statsInflight'), value: inflightCount, cls: 'text-blue-600 dark:text-blue-400', filter: STATUS_IN_FLIGHT.join(',') },
            { key: 'succeeded', label: t('statsSucceeded'), value: stats?.succeeded ?? 0, cls: 'text-green-600 dark:text-green-400', filter: 'succeeded' },
            { key: 'failed', label: t('statsFailed'), value: stats?.failed ?? 0, cls: 'text-red-600 dark:text-red-400', filter: 'failed' },
            { key: 'cancelled', label: t('statsCancelled'), value: stats?.cancelled ?? 0, cls: 'text-muted-foreground', filter: 'cancelled' },
          ] as const
        ).map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={statusFilter === c.filter}
            onClick={() => switchFilter(setStatusFilter)(c.filter)}
            className={cn(
              'rounded-md border bg-card/50 p-3 text-left transition-colors',
              statusFilter === c.filter
                ? 'border-primary/50 bg-primary/10'
                : 'border-border/50 hover:bg-muted/40',
            )}
          >
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
            <p className={cn('mt-1 flex items-center gap-1 text-xl font-bold tabular-nums', c.cls)}>
              {statsQuery.isFetching && stats === undefined ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                c.value
              )}
              {c.key === 'inflight' && inflightCount > 0 && (
                <span className="ml-auto inline-flex h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              )}
            </p>
          </button>
        ))}
      </section>

      {/* 按类型明细(与概览同源,点击直达类型过滤) */}
      {stats?.by_kind && (
        <div className="flex flex-wrap items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/70" />
          {Object.entries(stats.by_kind).map(([kind, v]) => (
            <button
              key={kind}
              type="button"
              onClick={() => switchFilter(setKindFilter)(kind)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                kindFilter === kind
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border/50 text-muted-foreground hover:bg-muted/40',
              )}
            >
              <span className={cn('font-medium', KIND_CLASS[kind])}>{kind}</span>
              <span className="tabular-nums">{v.total}</span>
              {v.inflight > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
            </button>
          ))}
        </div>
      )}

      {/* 状态 + 类型过滤 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => switchFilter(setStatusFilter)(f.key)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                statusFilter === f.key
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border/50 text-muted-foreground hover:bg-muted/40',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {kindFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => switchFilter(setKindFilter)(f.key)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                kindFilter === f.key
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border/50 text-muted-foreground hover:bg-muted/40',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {clearInfo && (
        <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
          {clearInfo}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border/50 bg-card/50">
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : listQuery.error ? (
          <div className="m-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {(listQuery.error as Error).message}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
            <Clapperboard className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t('empty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {tasks.map((task) => {
              const url = resultUrl(task)
              const hasResult = !!url
              return (
                <div key={task.id} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <MediaKindBadge kind={task.kind} t={t} />
                    <MediaTaskStatusBadge status={task.status} t={t} />
                    <span className="font-mono text-[11px] text-muted-foreground">{task.tool}</span>
                    <span className="text-[11px] text-muted-foreground/60">{fmt(task.created_at)}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      {hasResult && (
                        <>
                          <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
                            <PlayCircle className="h-3 w-3" />
                            {t('playable')}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-1.5 text-[10px]"
                            asChild
                          >
                            <a href={url} download target="_blank" rel="noreferrer">
                              <Download className="mr-1 h-3 w-3" />
                              {t('download')}
                            </a>
                          </Button>
                        </>
                      )}
                      {isInFlight(task.status) && task.task_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-1.5 text-[10px]"
                          disabled={cancelling === task.task_id}
                          onClick={() => cancelTask(task.task_id)}
                        >
                          {cancelling === task.task_id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <XCircle className="mr-1 h-3 w-3" />
                          )}
                          {cancelling === task.task_id ? t('cancelling') : t('cancel')}
                        </Button>
                      )}
                      {task.task_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                          disabled={deleting === task.task_id}
                          onClick={() => deleteTask(task.task_id)}
                          aria-label={t('delete')}
                        >
                          {deleting === task.task_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          {deleting === task.task_id ? t('deleting') : t('delete')}
                        </Button>
                      )}
                    </div>
                  </div>
                  {task.message && (
                    <p className="line-clamp-2 break-words text-xs text-muted-foreground">{task.message}</p>
                  )}
                  {task.task_id && (
                    <code className="block truncate rounded-sm bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {t('taskId')}: {task.task_id}
                    </code>
                  )}
                  {hasResult && <MediaResultPreview task={task} />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 分页 */}
      {!listQuery.isLoading && !listQuery.error && pages > 1 && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t('total', { total })}</span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="mr-0.5 h-3 w-3" />
              {t('prev')}
            </Button>
            <span className="min-w-[5.5rem] text-center">{t('pageInfo', { page, pages })}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              {t('next')}
              <ChevronRight className="ml-0.5 h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
