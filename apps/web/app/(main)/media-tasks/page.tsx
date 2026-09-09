// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw, Clapperboard, XCircle, PlayCircle, ImageIcon, Mic, Film, Music } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui-react'

/** 对话内媒体任务统一中心(2026-09-09 立)。
 *  展示 /api/media/tasks 落库的 video/music/tts/image 任务,
 *  支持按状态/类型过滤、产物播放/预览、在途任务取消与刷新。 */

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

const KIND_META: Record<string, { label: string; icon: typeof Film; className: string }> = {
  video: { label: '视频', icon: Film, className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  music: { label: '音乐', icon: Music, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  tts: { label: '语音', icon: Mic, className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  image: { label: '图片', icon: ImageIcon, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  processing: { label: '进行中', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  succeeded: { label: '已完成', className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  failed: { label: '失败', className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  cancelled: { label: '已取消', className: 'bg-muted text-muted-foreground' },
}

const STATUS_FILTERS = [
  { key: '', label: '全部' },
  { key: 'processing', label: '进行中' },
  { key: 'succeeded', label: '已完成' },
  { key: 'failed,cancelled', label: '失败/取消' },
]

const KIND_FILTERS = [
  { key: '', label: '全部类型' },
  { key: 'video', label: '视频' },
  { key: 'music', label: '音乐' },
  { key: 'tts', label: '语音' },
  { key: 'image', label: '图片' },
]

function MediaTaskStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: 'bg-muted text-muted-foreground' }
  return (
    <span className={cn('inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium', meta.className)}>
      {meta.label}
    </span>
  )
}

function MediaKindBadge({ kind }: { kind: string }) {
  const meta = KIND_META[kind] ?? { label: kind, icon: PlayCircle, className: 'bg-muted text-muted-foreground' }
  const Icon = meta.icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium', meta.className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
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

async function api<T>(url: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error || 'Request failed')
  return r.data
}

export default function MediaTasksPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = React.useState('')
  const [kindFilter, setKindFilter] = React.useState('')
  const [cancelling, setCancelling] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['media-tasks', statusFilter, kindFilter],
    queryFn: () =>
      api<{ ok: boolean; data: { items: MediaTask[]; total: number } }>(
        `/media/tasks?limit=50${statusFilter ? `&status=${statusFilter}` : ''}${kindFilter ? `&kind=${kindFilter}` : ''}`,
      ),
    refetchInterval: (q) => {
      const items = q.state.data?.data?.items ?? []
      return items.some((t) => t.status === 'processing') ? 5000 : false
    },
  })

  const tasks = listQuery.data?.data?.items ?? []

  const cancelTask = async (taskId: string) => {
    setCancelling(taskId)
    setError(null)
    try {
      const res = await api<{ ok: boolean; data?: { error?: string } }>(
        `/media/tasks/${encodeURIComponent(taskId)}/cancel`,
        { method: 'POST' },
      )
      if (res.data?.error) setError(`取消失败: ${res.data.error}`)
      await queryClient.invalidateQueries({ queryKey: ['media-tasks'] })
    } catch (e) {
      setError(`取消失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setCancelling(null)
    }
  }

  const dateFmt = new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Clapperboard className="h-6 w-6 text-primary" />
            媒体任务
          </h1>
          <p className="text-xs text-muted-foreground">
            对话内生成的视频/音乐/语音/图片任务统一入口:查看、播放、取消,产物就绪后自动刷新。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => listQuery.refetch()}
          disabled={listQuery.isFetching}
        >
          <RefreshCw className={cn('mr-1 h-4 w-4', listQuery.isFetching && 'animate-spin')} />
          刷新
        </Button>
      </header>

      {/* 状态 + 类型过滤 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
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
          {KIND_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setKindFilter(f.key)}
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

      <div className="overflow-hidden rounded-md border border-border/50 bg-card/50">
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : listQuery.error ? (
          <div className="m-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {(listQuery.error as Error).message}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
            <Clapperboard className="h-8 w-8 opacity-40" />
            <p className="text-sm">暂无媒体任务,在对话中生成视频/音乐/语音/图片后会自动记录在这里。</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {tasks.map((task) => {
              const hasResult = !!(task.result?.video_url || task.result?.audio_url || task.result?.image_url)
              return (
                <div key={task.id} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <MediaKindBadge kind={task.kind} />
                    <MediaTaskStatusBadge status={task.status} />
                    <span className="font-mono text-[11px] text-muted-foreground">{task.tool}</span>
                    <span className="text-[11px] text-muted-foreground/60">{fmt(task.created_at)}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      {task.status === 'processing' && task.task_id && (
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
                          取消
                        </Button>
                      )}
                      {hasResult && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
                          <PlayCircle className="h-3 w-3" />
                          可播放
                        </span>
                      )}
                    </div>
                  </div>
                  {task.message && (
                    <p className="line-clamp-2 break-words text-xs text-muted-foreground">{task.message}</p>
                  )}
                  {task.task_id && (
                    <code className="block truncate rounded-sm bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      task_id: {task.task_id}
                    </code>
                  )}
                  {hasResult && <MediaResultPreview task={task} />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
