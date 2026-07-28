'use client'

import * as React from 'react'
import {
  ChevronRight,
  Loader2,
  AlertCircle,
  Bot,
  HelpCircle,
  Wrench,
  Brain,
  FileText,
  Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useTimelineStore,
  type TimelineEvent,
  type TimelineEventStatus,
  type TimelineEventType,
} from '@/stores/timeline-store'

const TYPE_ICON: Record<TimelineEventType, React.ComponentType<{ className?: string }>> = {
  plan: FileText,
  subagent: Bot,
  question: HelpCircle,
  tool: Wrench,
  thinking: Brain,
  reference: FileText,
}

const TYPE_CLS: Record<TimelineEventType, { icon: string; bar: string }> = {
  plan: { icon: 'text-primary/70', bar: 'bg-primary/50' },
  subagent: { icon: 'text-cyan-500', bar: 'bg-cyan-500/50' },
  question: { icon: 'text-amber-500', bar: 'bg-amber-500/50' },
  tool: { icon: 'text-violet-500', bar: 'bg-violet-500/50' },
  thinking: { icon: 'text-amber-400', bar: 'bg-amber-400/50' },
  reference: { icon: 'text-blue-500', bar: 'bg-blue-500/50' },
}

const STATUS_CLS: Record<TimelineEventStatus, string> = {
  pending: 'text-muted-foreground/50',
  running: 'text-primary',
  done: 'text-emerald-500',
  failed: 'text-destructive',
}

const STATUS_ICON: Record<TimelineEventStatus, React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  running: Loader2,
  done: ChevronRight,
  failed: AlertCircle,
}

function formatRelativeTime(timestamp: string): string {
  const ms = Date.parse(timestamp)
  if (Number.isNaN(ms)) return ''
  const diff = Date.now() - ms
  if (diff < 0) return '刚刚'
  if (diff < 10_000) return '刚刚'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s 前`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m 前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h 前`
  return `${Math.floor(diff / 86_400_000)}d 前`
}

interface TimelineEventRowProps {
  event: TimelineEvent
  depth?: number
  'data-testid'?: string
}

export const TimelineEventRow = React.memo(function TimelineEventRow({
  event,
  depth = 0,
  'data-testid': testId,
}: TimelineEventRowProps) {
  const isExpanded = useTimelineStore((s) => s.expandedEventIds.includes(event.id))
  const toggleExpanded = useTimelineStore((s) => s.toggleExpanded)
  const TypeIcon = TYPE_ICON[event.type]
  const StatusIcon = STATUS_ICON[event.status]
  const typeCls = TYPE_CLS[event.type]
  const hasChildren = !!event.children && event.children.length > 0

  const onClick = () => {
    if (hasChildren) {
      toggleExpanded(event.id)
      return
    }
    // Trae Work 对齐(2026-07-28):timeline 事件可点击跳转到对话流对应位置
    // 优先级:messageId > planStepId > toolCallId(都通过 custom event 派发,MessageList 监听处理)
    if (event.messageId) {
      window.dispatchEvent(
        new CustomEvent('ihui:scroll-to-message', { detail: { messageId: event.messageId } }),
      )
      return
    }
    if (event.planStepId) {
      window.dispatchEvent(
        new CustomEvent('ihui:scroll-to-plan-step', { detail: { planStepId: event.planStepId } }),
      )
      return
    }
    if (event.toolCallId) {
      window.dispatchEvent(
        new CustomEvent('ihui:scroll-to-tool-call', { detail: { toolCallId: event.toolCallId } }),
      )
    }
  }

  // 至少有一种交互目标(children / messageId / planStepId / toolCallId)才可点
  const hasJumpTarget = !!(event.messageId || event.planStepId || event.toolCallId)
  const isClickable = hasChildren || hasJumpTarget

  return (
    <div
      className={cn('relative', depth > 0 && 'ml-3 border-l border-border/40 pl-3')}
      data-testid={testId ?? 'timeline-event-row'}
      data-event-id={event.id}
      data-event-type={event.type}
      data-event-status={event.status}
    >
      {depth === 0 && (
        <div
          className={cn('absolute left-0 top-0 h-full w-0.5 rounded-l-sm', typeCls.bar)}
          aria-hidden
        />
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={!isClickable}
        aria-expanded={hasChildren ? isExpanded : undefined}
        data-jump-target={hasJumpTarget ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-1.5 px-2 py-1 text-left transition-colors',
          isClickable ? 'hover:bg-accent/30 cursor-pointer' : 'cursor-default',
        )}
      >
        {hasChildren ? (
          <ChevronRight
            className={cn(
              'h-2.5 w-2.5 shrink-0 text-muted-foreground/60 transition-transform duration-150',
              isExpanded && 'rotate-90',
            )}
            aria-hidden
          />
        ) : (
          <span className="w-2.5" />
        )}
        <TypeIcon className={cn('h-3 w-3 shrink-0', typeCls.icon)} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/90">
          {event.title}
        </span>
        {event.description && !isExpanded && (
          <span className="hidden truncate text-[10px] text-muted-foreground/60 lg:inline">
            {event.description.slice(0, 60)}
            {event.description.length > 60 ? '…' : ''}
          </span>
        )}
        <StatusIcon
          className={cn(
            'h-2.5 w-2.5 shrink-0',
            STATUS_CLS[event.status],
            event.status === 'running' && 'animate-spin',
          )}
          aria-hidden
        />
        <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground/50">
          {formatRelativeTime(event.timestamp)}
        </span>
      </button>
      {hasChildren && isExpanded && (
        <div className="border-t border-border/30 px-2 py-1">
          {event.description && (
            <div className="mb-1.5 text-[10px] text-muted-foreground/70">{event.description}</div>
          )}
          <div className="space-y-0.5">
            {event.children!.map((child) => (
              <TimelineEventRow key={child.id} event={child} depth={(depth ?? 0) + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

export default TimelineEventRow
