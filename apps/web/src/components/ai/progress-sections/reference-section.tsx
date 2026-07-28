'use client'

import * as React from 'react'
import { ChevronRight, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * ReferenceSection — 参考内容折叠块(2026-07-28 立,Trae Work 对齐)
 *
 * 设计目标:
 * - 展示参考链接/文件列表
 * - 默认折叠(避免污染对话流)
 * - 点击展开
 */

export interface ReferenceItem {
  id: string
  title: string
  url?: string
  meta?: string
}

interface ReferenceSectionProps {
  title?: string
  items: ReferenceItem[]
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (v: boolean) => void
  className?: string
}

export const ReferenceSection = React.memo(function ReferenceSection({
  title = '参考内容',
  items,
  collapsed: collapsedProp,
  defaultCollapsed = true,
  onCollapsedChange,
  className,
}: ReferenceSectionProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed)
  const collapsed = collapsedProp ?? internalCollapsed

  const onClick = () => {
    const next = !collapsed
    if (collapsedProp === undefined) setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }

  if (items.length === 0) return null

  return (
    <div
      className={cn(
        'my-1 overflow-hidden rounded-md border border-border/40 bg-muted/20',
        className,
      )}
      data-testid="reference-section"
    >
      <button
        type="button"
        onClick={onClick}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent/30"
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150',
            !collapsed && 'rotate-90',
          )}
        />
        <Link2 className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
        <span className="flex-1 font-medium">{title}</span>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
          {items.length}
        </span>
      </button>
      {!collapsed && (
        <ul className="space-y-0.5 border-t border-border/40 px-2 py-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-1.5 text-[11px]">
              <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
              <span className="flex-1 truncate text-foreground/90">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {item.title}
                  </a>
                ) : (
                  item.title
                )}
              </span>
              {item.meta && (
                <span className="shrink-0 text-[10px] text-muted-foreground/60">{item.meta}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})
