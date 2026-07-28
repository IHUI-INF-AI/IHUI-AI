'use client'

/**
 * TimelineEvent — Trae Work 风格统一时间线条目(2026-07-28 立,Phase 20)
 *
 * 截图特征(Trae Work 时间线视图):
 * - 左侧时间戳 (text-[10px], tabular-nums)
 * - 中间圆点 (颜色映射 type + status)
 * - 右侧事件摘要 + 折叠/展开 children
 * - 事件类型: plan / subagent / question / tool / thinking / reference
 *
 * 圆点颜色映射:
 * - plan:     violet-500
 * - subagent: amber-500 (running) / emerald-500 (done) / red-500 (failed)
 * - question: sky-500
 * - tool:     primary
 * - thinking: muted-foreground
 * - reference:cyan-500
 *
 * 圆点状态:
 * - running: animate-pulse
 * - done:    实心
 * - failed:  红 + ✗
 * - pending: 空心
 *
 * 与现有 sub-agent-activity-feed.tsx / trae-block.tsx 协同:
 * - inline 模式仍由 SubAgentActivityFeed 渲染(保留)
 * - timeline 模式由本组件展平渲染所有事件
 */

import * as React from 'react'
import { ChevronDown, ChevronRight, Loader2, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  type TimelineEvent as TimelineEventData,
  type TimelineEventType,
  type TimelineEventStatus,
} from '@/stores/timeline-store'

interface TimelineEventProps {
  event: TimelineEventData
  /** 列表首项(用于隐藏顶部连接线) */
  isFirst?: boolean
  /** 列表末项(用于隐藏底部连接线) */
  isLast?: boolean
  /** 受控:外部强制展开/折叠 */
  expanded?: boolean
  /** 展开状态变化回调 */
  onExpandedChange?: (expanded: boolean) => void
  /** 点击事件回调(用于跳转到 message) */
  onClick?: (event: TimelineEventData) => void
  /** data-testid 覆盖 */
  'data-testid'?: string
  className?: string
}

const TYPE_LABEL: Record<TimelineEventType, string> = {
  plan: 'Plan',
  subagent: 'Subagent',
  question: 'Question',
  tool: 'Tool',
  thinking: 'Thinking',
  reference: 'Reference',
}

const TYPE_DOT_COLOR: Record<TimelineEventType, string> = {
  plan: 'bg-violet-500',
  subagent: 'bg-amber-500',
  question: 'bg-sky-500',
  tool: 'bg-primary',
  thinking: 'bg-muted-foreground/50',
  reference: 'bg-cyan-500',
}

function statusDotClass(type: TimelineEventType, status: TimelineEventStatus): string {
  if (status === 'failed') return 'bg-red-500'
  if (status === 'done' && type === 'subagent') return 'bg-emerald-500'
  if (status === 'running') {
    if (type === 'subagent') return 'bg-amber-500'
    return TYPE_DOT_COLOR[type]
  }
  if (status === 'pending') return 'bg-transparent'
  return TYPE_DOT_COLOR[type]
}

function formatTimestamp(timestamp: string): string {
  const ms = Date.parse(timestamp)
  if (Number.isNaN(ms)) return ''
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export const TimelineEventItem = React.memo(function TimelineEventItem({
  event,
  isFirst = false,
  isLast = false,
  expanded: expandedProp,
  onExpandedChange,
  onClick,
  'data-testid': testId = 'timeline-event',
  className,
}: TimelineEventProps) {
  const [internalExpanded, setInternalExpanded] = React.useState(false)
  const isControlled = expandedProp !== undefined
  const expanded = isControlled ? expandedProp : internalExpanded

  const hasChildren = !!event.children && event.children.length > 0

  const setExpanded = (v: boolean) => {
    if (!isControlled) setInternalExpanded(v)
    onExpandedChange?.(v)
  }

  const onHeaderClick = () => {
    onClick?.(event)
  }

  const onChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) setExpanded(!expanded)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onHeaderClick()
    }
  }

  return (
    <div
      className={cn('relative flex gap-2 py-1.5', className)}
      data-testid={testId}
      data-event-type={event.type}
      data-event-status={event.status}
    >
      {/* 左侧时间戳 */}
      <div className="w-10 shrink-0 pt-0.5 text-right text-[10px] tabular-nums text-muted-foreground/60">
        {formatTimestamp(event.timestamp)}
      </div>

      {/* 中间圆点 + 连接线 */}
      <div className="relative flex w-3 shrink-0 flex-col items-center">
        {!isFirst && (
          <div
            className="absolute left-1/2 top-0 h-1.5 w-px -translate-x-1/2 bg-border"
            aria-hidden
          />
        )}
        <div
          className={cn(
            'z-10 mt-1 inline-flex h-2.5 w-2.5 items-center justify-center rounded-full ring-2 ring-background',
            statusDotClass(event.type, event.status),
            event.status === 'running' && 'animate-pulse',
          )}
          aria-hidden
        >
          {event.status === 'failed' && (
            <X className="h-2 w-2 text-white" strokeWidth={3} />
          )}
          {event.status === 'running' && event.type !== 'subagent' && (
            <Loader2 className="h-2 w-2 animate-spin text-white" />
          )}
        </div>
        {!isLast && (
          <div
            className="absolute left-1/2 top-3.5 bottom-0 w-px -translate-x-1/2 bg-border"
            aria-hidden
          />
        )}
      </div>

      {/* 右侧内容 */}
      <div className="flex-1 min-w-0 pb-1">
        <div
          className={cn(
            'flex items-start gap-1.5 rounded-sm px-1.5 py-0.5',
            'hover:bg-muted/40 transition-colors',
            onClick && 'cursor-pointer',
          )}
          onClick={onHeaderClick}
          onKeyDown={onKeyDown}
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={onChevronClick}
              className="mt-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center text-muted-foreground/60 hover:text-foreground/80"
              aria-label={expanded ? '折叠子事件' : '展开子事件'}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronDown className="h-2.5 w-2.5" />
              ) : (
                <ChevronRight className="h-2.5 w-2.5" />
              )}
            </button>
          ) : (
            <span className="mt-0.5 inline-block h-3 w-3 shrink-0" aria-hidden />
          )}
          <span className="shrink-0 rounded bg-muted/50 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground/80">
            {TYPE_LABEL[event.type]}
          </span>
          <span className="flex-1 break-words text-[11px] text-foreground/90">
            {event.title}
          </span>
          {event.status === 'running' && (
            <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400">运行中</span>
          )}
          {event.status === 'failed' && (
            <span className="shrink-0 text-[10px] text-red-600 dark:text-red-400">失败</span>
          )}
        </div>

        {/* 详细描述(如有) */}
        {event.description && (
          <div className="ml-5 mt-0.5 break-words text-[10px] text-muted-foreground/80">
            {event.description}
          </div>
        )}

        {/* 子事件 */}
        {hasChildren && expanded && (
          <div className="ml-5 mt-1 space-y-0 border-l border-border/60 pl-2">
            {event.children!.map((child, i, arr) => (
              <TimelineEventItem
                key={child.id}
                event={child}
                isFirst={i === 0}
                isLast={i === arr.length - 1}
                data-testid={`${testId}-child`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

export default TimelineEventItem
