'use client'

/**
 * BatchHeader — 批次派发紫色星标(2026-07-28 立,Phase 19.8)
 *
 * 截图特征(Trae Work Subagent 派单流):
 * - 紫色星标 (Sparkles 图标, 紫罗兰色 violet-500/600)
 * - 批次名 + 任务数(粗体, 12px)
 * - 折叠箭头 chevron-right(展开时旋转 90°)
 * - 右侧 meta(状态:已完成 / 进行中 / 评估后保留)
 * - 浅色背景 + 左侧 1px 强调条(深 1 缩进)
 *
 * tone 视觉映射:
 * - default: 紫色(violet)
 * - success: 绿色(emerald)
 * - warning: 橙色(amber)
 * - info: 蓝色(sky)
 */

import * as React from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BatchHeaderTone = 'default' | 'success' | 'warning' | 'info'

const TONE_CLS: Record<BatchHeaderTone, { icon: string; accent: string; container: string }> = {
  default: {
    icon: 'text-violet-500 dark:text-violet-400',
    accent: 'bg-violet-500',
    container: 'bg-violet-500/[0.05] border-violet-500/30',
  },
  success: {
    icon: 'text-emerald-500 dark:text-emerald-400',
    accent: 'bg-emerald-500',
    container: 'bg-emerald-500/[0.05] border-emerald-500/30',
  },
  warning: {
    icon: 'text-amber-500 dark:text-amber-400',
    accent: 'bg-amber-500',
    container: 'bg-amber-500/[0.05] border-amber-500/30',
  },
  info: {
    icon: 'text-sky-500 dark:text-sky-400',
    accent: 'bg-sky-500',
    container: 'bg-sky-500/[0.05] border-sky-500/30',
  },
}

interface BatchHeaderProps {
  batchId: string
  title: string
  itemCount?: number
  /** 状态文字(可选):"已完成" / "进行中" / "评估后保留" */
  status?: string
  tone?: BatchHeaderTone
  collapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
  defaultCollapsed?: boolean
  children?: React.ReactNode
  className?: string
  'data-testid'?: string
}

export const BatchHeader = React.memo(function BatchHeader({
  batchId,
  title,
  itemCount,
  status,
  tone = 'default',
  collapsed: collapsedProp,
  onCollapsedChange,
  defaultCollapsed = false,
  children,
  className,
  'data-testid': testId = 'batch-header',
}: BatchHeaderProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed)
  const collapsed = collapsedProp ?? internalCollapsed
  const toneCls = TONE_CLS[tone]

  const onHeaderClick = () => {
    const next = !collapsed
    if (collapsedProp === undefined) setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }

  const onHeaderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onHeaderClick()
    }
  }

  return (
    <div
      className={cn(
        'relative my-1.5 overflow-hidden rounded-md border text-[11px] leading-relaxed',
        toneCls.container,
        className,
      )}
      data-testid={testId}
      data-batch-id={batchId}
    >
      {/* 左侧 1px 强调条 */}
      <div
        className={cn('absolute left-0 top-0 bottom-0 w-0.5', toneCls.accent)}
        aria-hidden
      />
      {/* 头部 */}
      <div
        className="flex cursor-pointer items-center gap-1.5 px-2 py-1 transition-colors hover:bg-accent/30"
        onClick={onHeaderClick}
        onKeyDown={onHeaderKeyDown}
        role="button"
        aria-expanded={!collapsed}
        tabIndex={0}
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150',
            !collapsed && 'rotate-90',
          )}
        />
        <Sparkles
          className={cn('h-3 w-3 shrink-0', toneCls.icon)}
          aria-hidden
        />
        <span className="flex-1 truncate text-[12px] font-semibold text-foreground/90">
          {title}
        </span>
        {itemCount !== undefined && itemCount > 0 && (
          <span className="shrink-0 rounded-sm bg-muted px-1 text-[10px] tabular-nums text-muted-foreground/80">
            {itemCount}
          </span>
        )}
        {status && (
          <span className="shrink-0 text-[10px] text-muted-foreground/70">{status}</span>
        )}
      </div>
      {/* 内容区:CSS grid 平滑高度 */}
      {children !== undefined && (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
        >
          <div className="overflow-hidden">
            <div className="px-2 pb-1.5 pt-0.5">{children}</div>
          </div>
        </div>
      )}
    </div>
  )
})

export default BatchHeader
