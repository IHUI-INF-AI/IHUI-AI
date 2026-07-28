'use client'

/**
 * BatchHeader — 批次派发紫色星标头部(Phase 19.8,2026-07-28 立)
 *
 * 对标 Trae Work 截图:批次派发时显示紫色 Sparkles + 粗体标题 + 折叠箭头。
 * 例:"批次 E: miniapp-taro community+social+distribution API 下沉"
 */

import * as React from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BatchTone = 'default' | 'success' | 'warning' | 'info'

const BATCH_TONE_CLS: Record<BatchTone, { star: string; bg: string }> = {
  default: { star: 'text-violet-500', bg: 'bg-violet-500/[0.04]' },
  success: { star: 'text-emerald-500', bg: 'bg-emerald-500/[0.04]' },
  warning: { star: 'text-amber-500', bg: 'bg-amber-500/[0.04]' },
  info: { star: 'text-sky-500', bg: 'bg-sky-500/[0.04]' },
}

interface BatchHeaderProps {
  /** 批次 ID,用于 data 属性 */
  batchId: string
  /** 批次标题 */
  title: string
  /** 任务数(可选) */
  itemCount?: number
  /** 状态 meta e.g. "已完成" / "进行中" */
  meta?: string
  /** tone 决定星标颜色 */
  tone?: BatchTone
  /** 折叠状态(可受控) */
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

export default BatchHeader
