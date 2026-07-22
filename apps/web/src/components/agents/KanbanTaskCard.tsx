'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { CenteredText } from '@/components/common/CenteredText'
import type { AgentTaskStatus, KanbanTask } from '@ihui/types'

// ---------------------------------------------------------------------------
// 共享常量(供 KanbanColumn / TaskDetailDialog 复用)
// ---------------------------------------------------------------------------

export const STATUS_BADGE_CLASS: Record<AgentTaskStatus, string> = {
  triage: 'bg-muted text-muted-foreground',
  todo: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  ready: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  in_progress: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  blocked: 'bg-red-500/15 text-red-600 dark:text-red-400',
  done: 'bg-green-500/15 text-green-600 dark:text-green-400',
}

export const PRIORITY_THRESHOLDS = { high: 10, medium: 1 } as const

export function getPriorityLevel(priority: number): 'high' | 'medium' | 'low' {
  if (priority >= PRIORITY_THRESHOLDS.high) return 'high'
  if (priority >= PRIORITY_THRESHOLDS.medium) return 'medium'
  return 'low'
}

export const PRIORITY_DOT_CLASS: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-gray-400',
}

/** 合法状态流转(基于 agent-runtime.ts 状态机) */
export const LEGAL_TRANSITIONS: Record<AgentTaskStatus, AgentTaskStatus[]> = {
  triage: ['todo'],
  todo: ['ready'],
  ready: ['in_progress', 'blocked'],
  in_progress: ['done', 'blocked'],
  blocked: ['ready', 'in_progress'],
  done: [],
}

const RTF_CACHE = new Map<string, Intl.RelativeTimeFormat>()

export function formatRelativeTime(iso: string, locale: string): string {
  let rtf = RTF_CACHE.get(locale)
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    RTF_CACHE.set(locale, rtf)
  }
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.round((then - now) / 1000)
  const absDiff = Math.abs(diffSec)

  if (absDiff < 60) return rtf.format(Math.round(diffSec), 'second')
  if (absDiff < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (absDiff < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (absDiff < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day')
  if (absDiff < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month')
  return rtf.format(Math.round(diffSec / 31536000), 'year')
}

export function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (ms < 0) return '—'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ${sec % 60}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

// ---------------------------------------------------------------------------
// KanbanTaskCard 组件
// ---------------------------------------------------------------------------

export interface KanbanTaskCardProps {
  task: KanbanTask
  onSelect: (task: KanbanTask) => void
}

export function KanbanTaskCard({ task, onSelect }: KanbanTaskCardProps) {
  const t = useTranslations('agents.kanban')
  const locale = useLocale()
  const level = getPriorityLevel(task.priority)

  return (
    <button
      type="button"
      onClick={() => onSelect(task)}
      className="w-full rounded-md border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-2">
        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT_CLASS[level])} aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium leading-snug">{task.name}</p>
          {task.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
          )}
          <div className="flex items-center gap-1.5 pt-0.5">
            <span
              className={cn(
                'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none',
                STATUS_BADGE_CLASS[task.status],
              )}
            >
              {t(task.status)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {t('created')} {formatRelativeTime(task.createdAt, locale)}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

/** 空状态提示(列内无任务时) */
export function KanbanTaskCardEmpty() {
  const t = useTranslations('agents.kanban')
  return (
    <div className="flex items-center justify-center rounded-md border border-dashed py-6 text-xs text-muted-foreground">
      <CenteredText enabled={false}>{t('empty')}</CenteredText>
    </div>
  )
}
