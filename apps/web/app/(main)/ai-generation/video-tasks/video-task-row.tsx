// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { getVideoTaskStatusLabelKey } from './status-badge'
import { formatDate } from '@/lib/date-utils'

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
  const t = useTranslations('videoTasksPage')
  const tStatus = useTranslations('aiGeneration')
  const videoUrl = task.status === 'success' ? extractVideoUrl(task.result) : null
  const statusLabelKey = getVideoTaskStatusLabelKey(task.status)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs min-[640px]:grid-cols-4">
        <div>
          <div className="text-muted-foreground">{t('volcanoTaskId')}</div>
          <div className="font-mono">{task.taskId}</div>
        </div>
        <div>
          <div className="text-muted-foreground">{t('updatedAt')}</div>
          <div>{formatDate(task.updatedAt)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">{t('status')}</div>
          <div>{statusLabelKey ? tStatus(statusLabelKey) : task.status}</div>
        </div>
        <div>
          <div className="text-muted-foreground">{t('message')}</div>
          <div className="min-w-0 truncate">{task.message || '-'}</div>
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
          {t('noVideoUrlExtracted')}
        </div>
      ) : null}
    </div>
  )
}

export function VideoTaskRowLoading() {
  const t = useTranslations('videoTasksPage')
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t('syncingStatus')}
    </div>
  )
}

export function VideoTaskRowError({ error }: { error: unknown }) {
  return <div className="text-sm text-destructive">{(error as Error).message}</div>
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
