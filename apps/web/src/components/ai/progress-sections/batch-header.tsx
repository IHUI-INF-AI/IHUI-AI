'use client'

import * as React from 'react'
import { ChevronRight, Loader2, CheckCircle2, XCircle, Zap, Users, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BatchStatus = 'running' | 'completed' | 'failed' | 'partial'

interface BatchHeaderProps {
  batchIndex: number
  totalBatches?: number
  title: string
  subtitle?: string
  agentCount: number
  completedCount: number
  failedCount?: number
  status: BatchStatus
  defaultCollapsed?: boolean
  collapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
  className?: string
  meta?: React.ReactNode
  'data-testid'?: string
}

const STATUS_ICON: Record<BatchStatus, React.ComponentType<{ className?: string }>> = {
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  partial: Zap,
}

const STATUS_CLS: Record<BatchStatus, { icon: string; bar: string; bg: string; border: string }> = {
  running: {
    icon: 'text-primary',
    bar: 'bg-primary/60',
    bg: 'bg-primary/[0.04]',
    border: 'border-primary/20',
  },
  completed: {
    icon: 'text-emerald-500',
    bar: 'bg-emerald-500/60',
    bg: 'bg-emerald-500/[0.04]',
    border: 'border-emerald-500/20',
  },
  failed: {
    icon: 'text-destructive',
    bar: 'bg-destructive/60',
    bg: 'bg-destructive/[0.04]',
    border: 'border-destructive/20',
  },
  partial: {
    icon: 'text-amber-500',
    bar: 'bg-amber-500/60',
    bg: 'bg-amber-500/[0.04]',
    border: 'border-amber-500/20',
  },
}

export const BatchHeader = React.memo(function BatchHeader({
  batchIndex,
  totalBatches,
  title,
  subtitle,
  agentCount,
  completedCount,
  failedCount = 0,
  status,
  defaultCollapsed = true,
  collapsed: collapsedProp,
  onCollapsedChange,
  className,
  meta,
  'data-testid': testId,
}: BatchHeaderProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed)
  const collapsed = collapsedProp ?? internalCollapsed
  const Icon = STATUS_ICON[status]
  const toneCls = STATUS_CLS[status]

  const toggle = () => {
    const next = !collapsed
    if (collapsedProp === undefined) setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }

  const progress = agentCount > 0 ? Math.round((completedCount / agentCount) * 100) : 0

  return (
    <div
      className={cn('relative', className)}
      data-testid={testId ?? 'batch-header'}
      data-status={status}
    >
      <div
        className={cn('absolute left-0 top-0 h-full w-0.5 rounded-l-md', toneCls.bar)}
        aria-hidden
      />
      <div className={cn('rounded-md border', toneCls.bg, toneCls.border)}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition-colors hover:bg-accent/30"
        >
          <ChevronRight
            className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150',
              !collapsed && 'rotate-90',
            )}
            aria-hidden
          />
          <Icon
            className={cn('h-3 w-3 shrink-0', toneCls.icon, status === 'running' && 'animate-spin')}
            aria-hidden
          />
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
            批次 {batchIndex}
            {totalBatches !== undefined && totalBatches > 1 && `/${totalBatches}`}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/90">
            {title}
          </span>
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-muted px-1 py-0.5 text-[10px] text-muted-foreground/80">
            <Users className="h-2.5 w-2.5" aria-hidden />
            {completedCount}/{agentCount}
            {failedCount > 0 && <span className="text-destructive">·{failedCount} 失败</span>}
          </span>
          {meta && <span className="shrink-0 text-[10px] text-muted-foreground/60">{meta}</span>}
        </button>
        {subtitle && !collapsed && (
          <div className="px-2 py-1 text-[10px] text-muted-foreground/60">
            <Bot className="mr-0.5 inline h-2.5 w-2.5" aria-hidden />
            {subtitle}
          </div>
        )}
        {!collapsed && progress > 0 && (
          <div className="h-0.5 overflow-hidden rounded-b-md bg-muted/40">
            <div
              className={cn('h-full transition-all duration-300', toneCls.bar)}
              style={{ width: `${progress}%` }}
              aria-hidden
            />
          </div>
        )}
      </div>
    </div>
  )
})

export default BatchHeader
