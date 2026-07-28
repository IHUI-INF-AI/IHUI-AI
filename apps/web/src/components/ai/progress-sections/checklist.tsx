'use client'

/**
 * Checklist — 任务清单绿色对勾(2026-07-28 立,Phase 19.9)
 *
 * 截图特征(Trae Work 任务计划流):
 * - 每行 ✓ 绿色对勾 + 任务文字
 * - 多任务用 `&` 符号连接(inline)或显示多行
 * - 视觉对比 Trae 截图: "P0-1: ... & P0-2: ..." 这种 inline
 * - 状态指示:
 *   - done: 绿对勾 + 正常文字
 *   - pending: 灰圆 + 灰文字
 *   - in_progress: 蓝色 spinner + 高亮文字
 * - 整体容器: 浅色背景 + 1px 边框(与 TraeBlock 风格一致)
 */

import * as React from 'react'
import { Check, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ChecklistItemStatus = 'done' | 'pending' | 'in_progress'

export interface ChecklistItem {
  id: string
  title: string
  status: ChecklistItemStatus
  meta?: string
}

interface ChecklistProps {
  items: ChecklistItem[]
  /** 标题,默认 "任务清单" */
  title?: string
  /** 是否 inline 模式(用 & 连接,默认 false 垂直列表) */
  inline?: boolean
  collapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
  defaultCollapsed?: boolean
  className?: string
  'data-testid'?: string
}

const STATUS_CLS: Record<
  ChecklistItemStatus,
  { dot: string; text: string; icon: React.ReactNode }
> = {
  done: {
    dot: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    text: 'text-foreground/85',
    icon: <Check className="h-2.5 w-2.5" strokeWidth={3} />,
  },
  pending: {
    dot: 'bg-muted-foreground/15 text-muted-foreground/40',
    text: 'text-muted-foreground/55',
    icon: <span className="h-1 w-1 rounded-full bg-current" />,
  },
  in_progress: {
    dot: 'bg-primary/20 text-primary',
    text: 'font-medium text-foreground/95',
    icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
  },
}

function StatusIcon({ status }: { status: ChecklistItemStatus }) {
  const cls = STATUS_CLS[status]
  return (
    <span
      className={cn(
        'mt-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full',
        cls.dot,
      )}
      aria-hidden
    >
      {status === 'done' ? (
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      ) : status === 'in_progress' ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      ) : (
        <span className="h-1 w-1 rounded-full bg-current" />
      )}
    </span>
  )
}

export const Checklist = React.memo(function Checklist({
  items,
  title,
  inline = false,
  collapsed: collapsedProp,
  onCollapsedChange,
  defaultCollapsed = false,
  className,
  'data-testid': testId = 'checklist',
}: ChecklistProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed)
  const collapsed = collapsedProp ?? internalCollapsed

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

  if (items.length === 0) return null

  const doneCount = items.filter((it) => it.status === 'done').length

  return (
    <div
      className={cn(
        'relative my-1.5 overflow-hidden rounded-md border border-border/60 bg-muted/30 text-[11px] leading-relaxed',
        className,
      )}
      data-testid={testId}
    >
      {/* 左侧 1px 强调条(emerald) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500"
        aria-hidden
      />
      {/* 头部 */}
      {title && (
        <div
          className="flex cursor-pointer items-center gap-1.5 px-2 py-1 transition-colors hover:bg-accent/30"
          onClick={onHeaderClick}
          onKeyDown={onHeaderKeyDown}
          role="button"
          aria-expanded={!collapsed}
          tabIndex={0}
        >
          <CheckCircle2
            className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150',
              !collapsed && 'rotate-90',
            )}
          />
          <span className="flex-1 truncate text-[11px] font-medium text-muted-foreground">
            {title}
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
            {doneCount}/{items.length}
          </span>
        </div>
      )}
      {/* 内容区 */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-2 pb-1.5 pt-0.5">
            {inline ? (
              // inline 模式:用 & 连接(对齐 Trae 截图 "P0-1: ... & P0-2: ...")
              <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                {items.map((item, idx) => {
                  const cls = STATUS_CLS[item.status]
                  return (
                    <React.Fragment key={item.id}>
                      {idx > 0 && (
                        <span className="text-muted-foreground/40" aria-hidden>
                          &amp;
                        </span>
                      )}
                      <span
                        className={cn('inline-flex items-center gap-1', cls.text)}
                        data-status={item.status}
                      >
                        <StatusIcon status={item.status} />
                        <span className="break-words">{item.title}</span>
                        {item.meta && (
                          <span className="shrink-0 text-[10px] text-muted-foreground/60">
                            {item.meta}
                          </span>
                        )}
                      </span>
                    </React.Fragment>
                  )
                })}
              </div>
            ) : (
              // 垂直列表模式
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const cls = STATUS_CLS[item.status]
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-1.5"
                      data-status={item.status}
                    >
                      <StatusIcon status={item.status} />
                      <span className={cn('flex-1 break-words', cls.text)}>
                        {item.title}
                      </span>
                      {item.meta && (
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
                          {item.meta}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

export default Checklist
