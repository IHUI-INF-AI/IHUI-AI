'use client'

/**
 * TraeBlock — Trae Work 风格块状容器(2026-07-28 立,Phase 18 极致对齐)
 *
 * 截图分析 Trae Work 消息流的 5 种核心块:
 * 1. Subagent 调用块  → SubagentBlock
 * 2. 工具结果块       → ToolResultBlock
 * 3. 思考块           → ThinkingBlock
 * 4. Checked Items    → CheckedItemsBlock
 * 5. 已对用户提问     → QuestionBlock
 *
 * 共同特征(本组件提供底层):
 * - 浅色背景: bg-muted/30 (Telegram 风格) 或 bg-card/60 (深度层次)
 * - 左侧 1px 强调条: 颜色映射 subagent.color / tool.status / question.priority
 * - 顶部 icon + 标题 + 可选 chevron(折叠/展开)
 * - 底部 meta:时间 / 耗时 / 资源消耗
 *
 * 本组件只提供容器骨架,具体内容由 children 决定。
 * 其他 5 个块组件都用本组件做外壳,保持视觉一致。
 */

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TraeBlockTone = 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'error' | 'info'

const TONE_CLS: Record<TraeBlockTone, { container: string; accent: string }> = {
  default: {
    container: 'bg-muted/30 border-border/60',
    accent: 'bg-muted-foreground/40',
  },
  muted: {
    container: 'bg-muted/20 border-border/40',
    accent: 'bg-muted-foreground/30',
  },
  accent: {
    container: 'bg-primary/[0.04] border-primary/20',
    accent: 'bg-primary/60',
  },
  success: {
    container: 'bg-emerald-500/[0.05] border-emerald-500/30',
    accent: 'bg-emerald-500',
  },
  warning: {
    container: 'bg-amber-500/[0.05] border-amber-500/30',
    accent: 'bg-amber-500',
  },
  error: {
    container: 'bg-red-500/[0.05] border-red-500/30',
    accent: 'bg-red-500',
  },
  info: {
    container: 'bg-sky-500/[0.05] border-sky-500/30',
    accent: 'bg-sky-500',
  },
}

interface TraeBlockProps {
  /** 左侧 1px 强调条颜色,默认 muted(中性) */
  tone?: TraeBlockTone
  /** 标题 */
  title?: React.ReactNode
  /** 副标题(标题下方的小字) */
  subtitle?: React.ReactNode
  /** 标题前的图标(可以是 emoji / lucide icon / 自定义 svg) */
  icon?: React.ReactNode
  /** 右侧 meta(时间 / 耗时 / 计数),左对齐排列 */
  meta?: React.ReactNode
  /** 折叠状态(可受控或非受控) */
  collapsible?: boolean
  defaultCollapsed?: boolean
  collapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
  children?: React.ReactNode
  className?: string
  'data-testid'?: string
}

export const TraeBlock = React.memo(function TraeBlock({
  tone = 'muted',
  title,
  subtitle,
  icon,
  meta,
  collapsible = false,
  defaultCollapsed = false,
  collapsed: collapsedProp,
  onCollapsedChange,
  children,
  className,
  'data-testid': testId,
}: TraeBlockProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed)
  const collapsed = collapsedProp ?? internalCollapsed
  const toneCls = TONE_CLS[tone]

  const onHeaderClick = () => {
    if (!collapsible) return
    const next = !collapsed
    if (collapsedProp === undefined) setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }

  const onHeaderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!collapsible) return
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
    >
      {/* 左侧 1px 强调条 */}
      <div
        className={cn('absolute left-0 top-0 bottom-0 w-0.5', toneCls.accent)}
        aria-hidden
      />
      {/* 头部 */}
      {(title || icon || meta) && (
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-1',
            collapsible && 'cursor-pointer hover:bg-accent/30 transition-colors',
          )}
          onClick={onHeaderClick}
          onKeyDown={onHeaderKeyDown}
          role={collapsible ? 'button' : undefined}
          aria-expanded={collapsible ? !collapsed : undefined}
          tabIndex={collapsible ? 0 : undefined}
        >
          {collapsible && (
            <ChevronRight
              className={cn(
                'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150',
                !collapsed && 'rotate-90',
              )}
            />
          )}
          {icon && <span className="shrink-0 text-muted-foreground/80">{icon}</span>}
          {title && (
            <span className="flex-1 truncate font-medium text-foreground/90">{title}</span>
          )}
          {subtitle && (
            <span className="shrink-0 text-[10px] text-muted-foreground/70">{subtitle}</span>
          )}
          {meta && <span className="shrink-0 text-[10px] text-muted-foreground/70">{meta}</span>}
        </div>
      )}
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

/**
 * ThinkingBlock — Trae Work 风格"思考"块
 * 截图特征:浅色背景 + 圆形 i 图标 + "思考" 标签 + 内容
 */
interface ThinkingBlockProps {
  content: string
  collapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
}

export const ThinkingBlock = React.memo(function ThinkingBlock({
  content,
  collapsed,
  onCollapsedChange,
}: ThinkingBlockProps) {
  if (!content) return null
  return (
    <TraeBlock
      tone="info"
      collapsible
      defaultCollapsed
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      icon={<ThinkingIcon />}
      title="思考"
      data-testid="trae-thinking-block"
    >
      <div className="whitespace-pre-wrap break-words text-muted-foreground/90">
        {content}
      </div>
    </TraeBlock>
  )
})

/** 圆形 i 图标(Trae Work 风格) */
function ThinkingIcon() {
  return (
    <span
      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500/15 text-[9px] font-bold leading-none text-sky-600 dark:text-sky-400"
      aria-hidden
    >
      i
    </span>
  )
}

/**
 * ToolResultBlock — Trae Work 风格"工具结果"块
 * 截图特征:浅色背景 + "扫描结果显示" 标题 + 列表(• 圆点) + 关键数字高亮
 */
interface ToolResultBlockProps {
  title: string
  /** 列表项,每项可以是字符串或 React 节点 */
  items: Array<{ key: string; value: React.ReactNode }>
  /** 底部备注(可选) */
  notes?: string
  /** 当前项状态 */
  status?: 'pending' | 'running' | 'success' | 'error'
  collapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
}

export const ToolResultBlock = React.memo(function ToolResultBlock({
  title,
  items,
  notes,
  status = 'success',
  collapsed,
  onCollapsedChange,
}: ToolResultBlockProps) {
  const tone: TraeBlockTone =
    status === 'error' ? 'error' : status === 'running' ? 'info' : 'success'
  return (
    <TraeBlock
      tone={tone}
      collapsible
      defaultCollapsed={false}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      title={title}
      data-testid="trae-tool-result-block"
    >
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-1.5">
            <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
            <span className="flex-1 break-words text-muted-foreground/90">
              <span className="font-medium text-foreground/80">{item.key}:</span> {item.value}
            </span>
          </li>
        ))}
      </ul>
      {notes && (
        <div className="mt-1 border-t border-border/40 pt-1 text-[10px] italic text-muted-foreground/70">
          {notes}
        </div>
      )}
    </TraeBlock>
  )
})

/**
 * CheckedItemsBlock — Trae Work 风格"已检查项"块
 * 截图特征:Result: PASS 标签 + Checked Items 列表(✓ 标记) + Notes + 资源使用
 */
interface CheckedItemsBlockProps {
  result: 'PASS' | 'FAIL' | 'WARN'
  items: Array<{ index: number; title: string; evidence?: string; passed: boolean }>
  notes?: string
  resourceUsage?: string
}

export const CheckedItemsBlock = React.memo(function CheckedItemsBlock({
  result,
  items,
  notes,
  resourceUsage,
}: CheckedItemsBlockProps) {
  const tone: TraeBlockTone =
    result === 'PASS' ? 'success' : result === 'FAIL' ? 'error' : 'warning'
  const resultCls =
    result === 'PASS'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
      : result === 'FAIL'
        ? 'bg-red-500/15 text-red-700 dark:text-red-400'
        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
  return (
    <TraeBlock
      tone={tone}
      title="完成证据"
      data-testid="trae-checked-items-block"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            Result:
          </span>
          <span
            className={cn(
              'rounded px-1.5 py-px text-[10px] font-bold tracking-wide',
              resultCls,
            )}
          >
            {result}
          </span>
        </div>
        <div>
          <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            Checked Items:
          </div>
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.index} className="flex items-start gap-1.5">
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[9px] font-bold leading-none',
                    item.passed
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-500/20 text-red-700 dark:text-red-400',
                  )}
                  aria-hidden
                >
                  {item.passed ? '✓' : '✗'}
                </span>
                <div className="flex-1 break-words">
                  <span className="font-medium text-foreground/80">
                    {item.index}. {item.title}
                  </span>
                  {item.evidence && (
                    <span className="ml-1 text-muted-foreground/80">{item.evidence}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
        {notes && (
          <div className="border-t border-border/40 pt-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
              Notes:
            </span>
            <p className="mt-0.5 break-words text-muted-foreground/90">{notes}</p>
          </div>
        )}
        {resourceUsage && (
          <div className="flex items-center justify-between border-t border-border/40 pt-1 text-[10px] text-muted-foreground/70">
            <span>Resource Usage:</span>
            <span className="tabular-nums">{resourceUsage}</span>
          </div>
        )}
      </div>
    </TraeBlock>
  )
})

/**
 * ProgressPoint — Trae Work 风格"进度点"元素
 * 截图特征:● 圆点 + 步骤名 + 状态图标(running 旋转 / success ✓ / pending 灰)
 */
type ProgressPointStatus = 'pending' | 'running' | 'success' | 'error'

interface ProgressPointProps {
  status: ProgressPointStatus
  label: string
  meta?: React.ReactNode
}

export const ProgressPoint = React.memo(function ProgressPoint({
  status,
  label,
  meta,
}: ProgressPointProps) {
  return (
    <div className="flex items-center gap-1.5 py-0.5 text-[11px]">
      <span
        className={cn(
          'inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full',
          status === 'success' && 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
          status === 'running' && 'bg-primary/20 text-primary',
          status === 'error' && 'bg-red-500/20 text-red-600 dark:text-red-400',
          status === 'pending' && 'bg-muted-foreground/15 text-muted-foreground/50',
        )}
        aria-hidden
      >
        {status === 'running' ? (
          <span className="h-1.5 w-1.5 animate-spin rounded-full border border-current border-t-transparent" />
        ) : status === 'success' ? (
          <span className="text-[8px] font-bold leading-none">✓</span>
        ) : status === 'error' ? (
          <span className="text-[8px] font-bold leading-none">✗</span>
        ) : (
          <span className="h-1 w-1 rounded-full bg-current" />
        )}
      </span>
      <span
        className={cn(
          'flex-1 break-words',
          status === 'pending' && 'text-muted-foreground/60',
          status === 'running' && 'font-medium text-foreground/90',
        )}
      >
        {label}
      </span>
      {meta && (
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
          {meta}
        </span>
      )}
    </div>
  )
})

/**
 * ProgressPointList — 进度点列容器(Trae Work 风格"● 已读取 page.tsx"序列)
 */
interface ProgressPointListProps {
  points: Array<{
    id: string
    status: ProgressPointStatus
    label: string
    meta?: React.ReactNode
  }>
  className?: string
}

export const ProgressPointList = React.memo(function ProgressPointList({
  points,
  className,
}: ProgressPointListProps) {
  if (points.length === 0) return null
  return (
    <div className={cn('space-y-0', className)} data-testid="trae-progress-points">
      {points.map((p) => (
        <ProgressPoint key={p.id} status={p.status} label={p.label} meta={p.meta} />
      ))}
    </div>
  )
})
