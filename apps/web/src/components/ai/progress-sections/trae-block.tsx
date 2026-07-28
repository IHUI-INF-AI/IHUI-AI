'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * TraeBlock — Trae Work 风格的统一块状容器(2026-07-28 立,深度对标 Trae Work)
 *
 * 设计目标:
 * - 统一的浅色背景、左侧强调条、标题栏、内容区结构
 * - 支持多种状态(neutral/active/success/warning/danger)
 * - 适配 Trae Work 块状元素的视觉语言(浅灰底 + 圆角 + 边框)
 *
 * 用途:
 * - ThinkingSection:思考块
 * - ToolCallsSection:工具调用块
 * - SubagentSection:子代理块
 * - QuestionBlock:已对用户提问块
 * - ResourceBudget:资源预算块
 * - ReferenceSection:参考内容块
 */

export type TraeBlockTone = 'neutral' | 'active' | 'success' | 'warning' | 'danger' | 'muted'

const TONE_CLS: Record<TraeBlockTone, { bg: string; border: string; bar: string; title: string }> = {
  neutral: {
    bg: 'bg-card/40',
    border: 'border-border/40',
    bar: 'bg-muted-foreground/40',
    title: 'text-foreground/80',
  },
  active: {
    bg: 'bg-primary/[0.04]',
    border: 'border-primary/20',
    bar: 'bg-primary/60',
    title: 'text-foreground/90',
  },
  success: {
    bg: 'bg-emerald-500/[0.04]',
    border: 'border-emerald-500/20',
    bar: 'bg-emerald-500/60',
    title: 'text-foreground/90',
  },
  warning: {
    bg: 'bg-amber-500/[0.04]',
    border: 'border-amber-500/20',
    bar: 'bg-amber-500/60',
    title: 'text-foreground/90',
  },
  danger: {
    bg: 'bg-destructive/[0.04]',
    border: 'border-destructive/20',
    bar: 'bg-destructive/60',
    title: 'text-foreground/90',
  },
  muted: {
    bg: 'bg-muted/30',
    border: 'border-border/40',
    bar: 'bg-muted-foreground/30',
    title: 'text-muted-foreground',
  },
}

interface TraeBlockProps {
  tone?: TraeBlockTone
  title?: React.ReactNode
  icon?: React.ReactNode
  meta?: React.ReactNode
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
  children?: React.ReactNode
  className?: string
  /** 是否显示左侧强调条(默认 true) */
  showBar?: boolean
  /** 测试用 testid */
  testId?: string
}

export const TraeBlock = React.memo(function TraeBlock({
  tone = 'neutral',
  title,
  icon,
  meta,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  children,
  className,
  showBar = true,
  testId,
}: TraeBlockProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed)
  const collapsed = collapsedProp ?? internalCollapsed
  const toneCls = TONE_CLS[tone]

  const onClick = () => {
    const next = !collapsed
    if (collapsedProp === undefined) setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }

  const hasHeader = title || icon || meta

  return (
    <div
      className={cn('relative', className)}
      data-testid={testId ?? 'trae-block'}
      data-tone={tone}
    >
      {showBar && (
        <div
          className={cn('absolute left-0 top-0 h-full w-0.5 rounded-l-md', toneCls.bar)}
          aria-hidden
        />
      )}
      <div className={cn('rounded-md border', toneCls.bg, toneCls.border)}>
        {hasHeader && (
          <button
            type="button"
            onClick={onClick}
            aria-expanded={!collapsed}
            className={cn(
              'flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] transition-colors',
              toneCls.title,
              'hover:bg-accent/30',
            )}
          >
            {icon && <span className="shrink-0">{icon}</span>}
            {title && <span className="flex-1 truncate font-medium">{title}</span>}
            {meta && <span className="shrink-0 text-[10px] opacity-80">{meta}</span>}
          </button>
        )}
        {!collapsed && children && (
          <div className={cn(hasHeader && 'border-t border-border/30 px-2 py-1')}>
            {children}
          </div>
        )}
      </div>
    </div>
  )
})
