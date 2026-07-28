'use client'

import * as React from 'react'
import { ChevronRight, Loader2, CheckCircle2, XCircle, Zap, Users, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * BatchHeader — 批次头(2026-07-28 立,Trae Work 对齐)
 *
 * 用途:多 subagent 派单的"批次"维度,显示
 * - 批次序号 / 总批次数
 * - 批次主题
 * - 进度:已完成 N / 总 M
 * - 批次状态(running/done/failed)
 *
 * 设计:
 * - 类似 Trae Work 的"任务批次"卡片:左侧 0.5px 强调条
 * - 折叠/展开批次详情
 * - 标题可点击跳转到对话流中关联消息
 */

export type BatchStatus = 'running' | 'completed' | 'failed' | 'partial'

interface BatchHeaderProps {
  /** 批次序号(从 1 开始) */
  batchIndex: number
  /** 总批次数 */
  totalBatches?: number
  /** 批次主题(主标题) */
  title: string
  /** 批次副标题(可选) */
  subtitle?: string
  /** 批次内 subagent 数量 */
  agentCount: number
  /** 已完成数 */
  completedCount: number
  /** 失败数 */
  failedCount?: number
  status: BatchStatus
  /** 是否默认展开 */
  defaultCollapsed?: boolean
  /** 受控折叠 */
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
      {/* 左侧强调条 */}
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
            className={cn(
              'h-3 w-3 shrink-0',
              toneCls.icon,
              status === 'running' && 'animate-spin',
            )}
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
          <div className="border-t border-border/30 px-2 py-1 text-[10px] text-muted-foreground/60">
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
