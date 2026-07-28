'use client'

import * as React from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * BatchHeader — 批次派发头部(2026-07-28 立,深度对标 Trae Work)
 *
 * 设计目标:
 * - 紫色星标表示批次开始(Subagent 派单)
 * - 显示任务数 + 状态
 * - 可折叠/展开
 */

export type BatchTone = 'default' | 'success' | 'warning' | 'info'

const BATCH_TONE_CLS: Record<BatchTone, { star: string; bg: string }> = {
  default: { star: 'text-violet-500', bg: 'bg-violet-500/[0.04]' },
  success: { star: 'text-emerald-500', bg: 'bg-emerald-500/[0.04]' },
  warning: { star: 'text-amber-500', bg: 'bg-amber-500/[0.04]' },
  info: { star: 'text-sky-500', bg: 'bg-sky-500/[0.04]' },
}

interface BatchHeaderProps {
  batchId: string
  title: string
  itemCount?: number
  meta?: string
  tone?: BatchTone
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
  className?: string
}

export const BatchHeader = React.memo(function BatchHeader({
  batchId,
  title,
  itemCount,
  meta,
  tone = 'default',
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  className,
}: BatchHeaderProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed)
  const collapsed = collapsedProp ?? internalCollapsed
  const toneCls = BATCH_TONE_CLS[tone]

  const onClick = () => {
    const next = !collapsed
    if (collapsedProp === undefined) setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-sm border border-border/40 px-2 py-1 transition-colors',
        toneCls.bg,
        className,
      )}
      data-batch-id={batchId}
      data-testid="batch-header"
    >
      <button
        type="button"
        onClick={onClick}
        aria-expanded={!collapsed}
        className="flex flex-1 items-center gap-1.5 text-left"
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150',
            !collapsed && 'rotate-90',
          )}
        />
        <Sparkles className={cn('h-3 w-3 shrink-0', toneCls.star)} aria-hidden />
        <span className="flex-1 truncate text-[11px] font-semibold text-foreground/90">
          {title}
        </span>
        {itemCount !== undefined && itemCount > 0 && (
          <span className="shrink-0 rounded-sm bg-muted px-1 text-[10px] tabular-nums text-muted-foreground/80">
            {itemCount}
          </span>
        )}
        {meta && (
          <span className="shrink-0 text-[10px] text-muted-foreground/70">{meta}</span>
        )}
      </button>
    </div>
  )
})
