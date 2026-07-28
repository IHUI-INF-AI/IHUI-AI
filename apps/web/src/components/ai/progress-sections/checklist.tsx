'use client'

import * as React from 'react'
import { Check, Circle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Checklist — 检查清单组件(2026-07-28 立,Trae Work 对齐)
 *
 * 设计目标:
 * - 绿色对勾清单(done 状态)
 * - 三态:done / pending / in_progress
 * - 可折叠
 * - 用于展示任务完成情况
 */

export type ChecklistStatus = 'done' | 'pending' | 'in_progress'

export interface ChecklistItem {
  id: string
  title: string
  status: ChecklistStatus
  meta?: string
}

interface ChecklistProps {
  items: ChecklistItem[]
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
  className?: string
  testId?: string
}

export const Checklist = React.memo(function Checklist({
  items,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  className,
  testId,
}: ChecklistProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed)
  const collapsed = collapsedProp ?? internalCollapsed

  const onClick = () => {
    const next = !collapsed
    if (collapsedProp === undefined) setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }

  const completedCount = items.filter((i) => i.status === 'done').length

  return (
    <div
      className={cn(
        'rounded-sm border border-border/40 bg-card/40 px-2 py-1 text-[11px]',
        className,
      )}
      data-testid={testId ?? 'checklist'}
    >
      <button
        type="button"
        onClick={onClick}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <span className="flex-1 font-medium text-foreground/90">检查清单</span>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
          {completedCount}/{items.length}
        </span>
      </button>
      {!collapsed && (
        <ul className="mt-1 space-y-0.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-1.5">
              <span
                className={cn(
                  'mt-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full',
                  item.status === 'done'
                    ? 'bg-emerald-500/20 text-emerald-600'
                    : item.status === 'in_progress'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted-foreground/15 text-muted-foreground/50',
                )}
                aria-hidden
              >
                {item.status === 'done' ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                ) : item.status === 'in_progress' ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <Circle className="h-2.5 w-2.5" />
                )}
              </span>
              <span
                className={cn(
                  'flex-1 break-words',
                  item.status === 'done' && 'text-muted-foreground/80 line-through',
                  item.status === 'in_progress' && 'font-medium text-foreground/90',
                  item.status === 'pending' && 'text-muted-foreground/70',
                )}
              >
                {item.title}
              </span>
              {item.meta && (
                <span className="shrink-0 text-[10px] text-muted-foreground/60">
                  {item.meta}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})
