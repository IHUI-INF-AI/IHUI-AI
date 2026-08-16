'use client'

/**
 * 上传进度条组件
 *
 * 用于文件 / 封面图上传时显示进度、文件名、大小、百分比。
 * 状态:uploading(主色脉冲)/ success(emerald)/ error(rose)。
 *
 * AGENTS.md §4:h-2 rounded-md 进度条(禁 rounded-full)/ 无分割线 / 禁渐变遮罩
 */

import * as React from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export type UploadStatus = 'uploading' | 'success' | 'error'

export interface UploadProgressProps {
  readonly progress: number
  readonly fileName?: string
  readonly status: UploadStatus
  readonly fileSize?: number
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

const STATUS_ICON: Record<UploadStatus, React.ComponentType<{ className?: string }>> = {
  uploading: Loader2,
  success: CheckCircle2,
  error: XCircle,
}

const STATUS_ICON_CLASS: Record<UploadStatus, string> = {
  uploading: 'h-3.5 w-3.5 animate-spin text-primary',
  success: 'h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400',
  error: 'h-3.5 w-3.5 text-rose-600 dark:text-rose-400',
}

const STATUS_TEXT_CLASS: Record<UploadStatus, string> = {
  uploading: 'text-muted-foreground',
  success: 'text-emerald-700 dark:text-emerald-400',
  error: 'text-rose-700 dark:text-rose-400',
}

const STATUS_BAR_CLASS: Record<UploadStatus, string> = {
  uploading: 'bg-primary animate-pulse',
  success: 'bg-emerald-500',
  error: 'bg-rose-500',
}

export function UploadProgress({ progress, fileName, status, fileSize }: UploadProgressProps) {
  const t = useTranslations('publish')
  const Icon = STATUS_ICON[status]
  const clamped = Math.max(0, Math.min(100, progress))
  const labelKey =
    status === 'uploading'
      ? 'uploadProgress'
      : status === 'success'
        ? 'uploadSuccess'
        : 'uploadFailed'

  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 p-2.5">
      <div className="flex items-center gap-2">
        <Icon className={STATUS_ICON_CLASS[status]} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {fileName ?? t(labelKey)}
        </span>
        {typeof fileSize === 'number' && fileSize > 0 && (
          <span className="shrink-0 text-[10px] text-muted-foreground">{fmtSize(fileSize)}</span>
        )}
        <span className={cn('shrink-0 text-[10px] font-mono', STATUS_TEXT_CLASS[status])}>
          {clamped.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-md bg-muted">
        <div
          className={cn('h-full transition-all duration-300', STATUS_BAR_CLASS[status])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
