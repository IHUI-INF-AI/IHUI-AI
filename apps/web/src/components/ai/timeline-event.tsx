'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimelineStore, type TimelineEvent, type TimelineEventType } from '@/stores/timeline-store'

/**
 * TimelineEventItem — 时间线中的单个事件条目(2026-07-28 立,Trae Work 对齐)
 *
 * 设计目标:
 * - 时间戳 + 类型点 + 类型徽章 + 状态
 * - 子事件可折叠(has children)
 * - 点击事件触发 onClick
 */

const TYPE_CLS: Record<TimelineEventType, { dot: string; label: string }> = {
  plan: { dot: 'bg-primary', label: 'PLAN' },
  subagent: { dot: 'bg-violet-500', label: 'AGENT' },
  question: { dot: 'bg-amber-500', label: 'Q&A' },
  tool: { dot: 'bg-sky-500', label: 'TOOL' },
  thinking: { dot: 'bg-emerald-500', label: 'THINK' },
  reference: { dot: 'bg-muted-foreground/50', label: 'REF' },
}

const STATUS_LABEL: Record<TimelineEvent['status'], string> = {
  pending: '等待',
  running: '执行中',
  done: '完成',
  failed: '失败',
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '--:--'
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  } catch {
    return '--:--'
  }
}

interface TimelineEventItemProps {
  event: TimelineEvent
  onClick?: (event: TimelineEvent) => void
}

export const TimelineEventItem = React.memo(function TimelineEventItem({
  event,
  onClick,
}: TimelineEventItemProps) {
  const isExpanded = useTimelineStore((s) => s.expandedEventIds.includes(event.id))
  const toggleExpanded = useTimelineStore((s) => s.toggleExpanded)
  const typeCls = TYPE_CLS[event.type]
  const time = formatTime(event.timestamp)
  const hasChildren = !!event.children && event.children.length > 0

  return (
    <div
      data-testid="timeline-event"
      data-event-type={event.type}
      data-event-status={event.status}
      className="flex items-start gap-2 py-1"
    >
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">{time}</span>
      <div className="relative flex shrink-0 flex-col items-center">
        <span
          className={cn(
            'inline-block h-2 w-2 rounded-full',
            typeCls.dot,
            event.status === 'running' && 'animate-pulse ring-2 ring-primary/30',
          )}
          aria-hidden
        />
        {hasChildren && (
          <span className="absolute top-2 h-full w-px bg-border/60" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => {
            if (hasChildren) toggleExpanded(event.id)
            onClick?.(event)
          }}
          className="flex w-full items-center gap-1.5 text-left"
        >
          {hasChildren ? (
            <ChevronRight
              className={cn(
                'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150',
                isExpanded && 'rotate-90',
              )}
            />
          ) : null}
          <span className="flex-1 truncate text-[11px] text-foreground/90">{event.title}</span>
          <span
            className={cn(
              'shrink-0 rounded-sm px-1 text-[9px] font-medium uppercase tracking-wide',
              'bg-muted text-muted-foreground/70',
            )}
          >
            {typeCls.label}
          </span>
          <span
            className={cn(
              'shrink-0 text-[10px] tabular-nums',
              event.status === 'running' && 'text-primary',
              event.status === 'done' && 'text-emerald-500',
              event.status === 'failed' && 'text-red-500',
              event.status === 'pending' && 'text-muted-foreground/60',
            )}
          >
            {STATUS_LABEL[event.status]}
          </span>
        </button>
        {event.description && (
          <p className="mt-0.5 break-words pl-4 text-[10px] text-muted-foreground/70">
            {event.description}
          </p>
        )}
        {isExpanded && hasChildren && event.children && (
          <div className="ml-2 mt-1 space-y-0.5 border-l border-border/40 pl-2">
            {event.children.map((child) => (
              <TimelineEventItem key={child.id} event={child} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
