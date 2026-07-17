import { Loader2 } from 'lucide-react'

import { getVideoTaskStatusLabel } from './status-badge'

export interface VideoTask {
  id: number
  taskId: string
  status: string
  message: string | null
  result: string | null
  createdAt: string
  updatedAt: string
}

function extractVideoUrl(result: string | null): string | null {
  if (!result) return null
  try {
    const parsed = JSON.parse(result) as { video_urls?: string[]; raw?: unknown }
    if (Array.isArray(parsed.video_urls) && parsed.video_urls.length > 0) {
      const url = parsed.video_urls[0]
      return url ?? null
    }
  } catch {
    if (/^https?:\/\//i.test(result)) return result
  }
  return null
}

export function VideoTaskRowExpansion({ task, warning }: { task: VideoTask; warning?: string }) {
  const videoUrl = task.status === 'success' ? extractVideoUrl(task.result) : null
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <div className="text-muted-foreground">火山 Task ID</div>
          <div className="font-mono">{task.taskId}</div>
        </div>
        <div>
          <div className="text-muted-foreground">更新时间</div>
          <div>{new Date(task.updatedAt).toLocaleString()}</div>
        </div>
        <div>
          <div className="text-muted-foreground">状态</div>
          <div>{getVideoTaskStatusLabel(task.status)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">消息</div>
          <div className="truncate">{task.message || '-'}</div>
        </div>
      </div>
      {warning ? (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-300">
          {warning}
        </div>
      ) : null}
      {videoUrl ? (
        <video
          src={videoUrl}
          controls
          className="w-full max-w-2xl rounded-lg border border-border bg-black"
        >
          <track kind="captions" />
        </video>
      ) : task.status === 'success' ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          任务标记为完成但未提取到视频 URL
        </div>
      ) : null}
    </div>
  )
}

export function VideoTaskRowLoading() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      同步状态中...
    </div>
  )
}

export function VideoTaskRowError({ error }: { error: unknown }) {
  return <div className="text-sm text-destructive">{(error as Error).message}</div>
}
