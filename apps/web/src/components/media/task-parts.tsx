// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Film, ImageIcon, Mic, Music, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 媒体任务共享类型与展示辅助(P3 #31 全局任务看板,2026-09-16 立)。
 *
 * 从 media-tasks/page.tsx 提取:列表视图与看板视图共用同一套类型/徽章/状态集,
 * 避免两处定义漂移(尤其 MediaTask 加 chat_id 后,两视图必须同源)。
 */

export interface MediaTaskResult {
  image_url?: string | null
  audio_url?: string | null
  video_url?: string | null
}

export interface MediaTask {
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
  /** 发起任务的会话 id(P3 #31:llm.py call_tool 透传 conversationId 落库;
   *  有值时看板卡片可深链跳回 /chat?conversationId=;历史任务为空串=不可跳) */
  chat_id?: string
}

export interface MediaTaskStats {
  by_kind: Record<
    string,
    { total: number; succeeded: number; failed: number; cancelled: number; inflight: number }
  >
  total: number
  inflight: number
  succeeded: number
  failed: number
  cancelled: number
}

export const PAGE_SIZE = 10

/** 在途状态集(2026-09-09 收尾修复):与后端 _STATUS_IN_FLIGHT 保持一致,
 *  轮询/取消按钮/状态过滤统一按此判断,不再只认 processing。 */
export const STATUS_IN_FLIGHT: readonly string[] = [
  'processing',
  'accepted',
  'submitted',
  'pending',
]

export const isInFlight = (status: string): boolean => STATUS_IN_FLIGHT.includes(status)

/** P3 #31 看板列分组:进行中(processing)= provider 正在生成;
 *  排队中(pending/accepted/submitted)= 已提交等 provider;
 *  已完成(succeeded/failed/cancelled)= 全部终态。 */
export const COLUMN_RUNNING_STATUSES: readonly string[] = ['processing']
export const COLUMN_WAITING_STATUSES: readonly string[] = ['pending', 'accepted', 'submitted']

export const KIND_ICONS: Record<string, typeof Film> = {
  video: Film,
  music: Music,
  tts: Mic,
  image: ImageIcon,
}

export const KIND_CLASS: Record<string, string> = {
  video: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  music: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  tts: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  image: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

export const STATUS_CLASS: Record<string, string> = {
  processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  accepted: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  submitted: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  pending: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  succeeded: 'bg-green-500/10 text-green-600 dark:text-green-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  cancelled: 'bg-muted text-muted-foreground',
}

export const STATUS_LABEL_KEY: Record<string, string> = {
  processing: 'statusBadgeProcessing',
  accepted: 'statusBadgeProcessing',
  submitted: 'statusBadgeProcessing',
  pending: 'statusBadgeProcessing',
  succeeded: 'statusBadgeSucceeded',
  failed: 'statusBadgeFailed',
  cancelled: 'statusBadgeCancelled',
}

export function MediaTaskStatusBadge({
  status,
  t,
}: {
  status: string
  t: (key: string) => string
}) {
  const labelKey = STATUS_LABEL_KEY[status]
  const label = labelKey ? t(labelKey) : status
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
        STATUS_CLASS[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {label}
    </span>
  )
}

export function MediaKindBadge({ kind, t }: { kind: string; t: (key: string) => string }) {
  const labelKey = `kind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`
  const label = t(labelKey) === labelKey ? kind : t(labelKey)
  const Icon = KIND_ICONS[kind] ?? PlayCircle
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
        KIND_CLASS[kind] ?? 'bg-muted text-muted-foreground',
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

export function MediaResultPreview({ task }: { task: MediaTask }) {
  const urls = task.result ?? {}
  if (urls.video_url) {
    return (
      <video
        controls
        src={urls.video_url}
        preload="metadata"
        className="w-full max-w-md rounded-md border border-border"
      >
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
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 动态远程图片降级用 img
      <img
        src={urls.image_url}
        alt={task.message || 'media'}
        className="w-full max-w-md rounded-md border border-border"
      />
    )
  }
  return null
}

export function resultUrl(task: MediaTask): string | null {
  const urls = task.result ?? {}
  return urls.video_url || urls.audio_url || urls.image_url || null
}
