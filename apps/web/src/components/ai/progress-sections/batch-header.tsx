// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ChevronRight, Loader2, CheckCircle2, XCircle, Zap, Users, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProgressRing } from './progress-ring'

export type BatchStatus = 'running' | 'completed' | 'failed' | 'partial'

interface BatchHeaderProps {
  batchIndex: number
  totalBatches?: number
  title: string
  subtitle?: string
  agentCount: number
  completedCount: number
  failedCount?: number
  /** 深化O(2026-11-17):运行中子代理数 —— running 状态时显示"·N 个运行中",一眼看到还有几个在跑。缺席/0 不造残标 */
  runningCount?: number
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
    border: 'border-stroke-selected',
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
  runningCount = 0,
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
          {/* 深化T(2026-11-17):折叠态进度环 —— 折叠看不到底部进度条,改在折叠行内嵌小进度环。
            有进度(>0)时替换状态图标,用户折叠态一眼看到整体完成率;无进度时仍用状态图标。
            completed 状态用 completed 态,其余用 in_progress;失败用 idle(红色调由外层控制)。 */}
          {progress > 0 ? (
            <ProgressRing
              value={progress}
              state={
                status === 'completed' ? 'completed' : status === 'running' ? 'in_progress' : 'idle'
              }
              centerMode="none"
              size={14}
              strokeWidth={2}
              aria-label={`批次进度 ${progress}%`}
            />
          ) : (
            <Icon
              className={cn(
                'h-3 w-3 shrink-0',
                toneCls.icon,
                status === 'running' && 'animate-spin',
              )}
              aria-hidden
            />
          )}
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
            {runningCount > 0 && status === 'running' && (
              <span className="text-primary">·{runningCount} 个运行中</span>
            )}
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
