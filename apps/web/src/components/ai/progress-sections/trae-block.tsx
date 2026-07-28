'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TraeBlockTone =
  | 'neutral'
  | 'active'
  | 'success'
  | 'warning'
  | 'danger'
  | 'muted'
  | 'primary'

const TONE_CLS: Record<
  TraeBlockTone,
  { bg: string; border: string; bar: string; title: string }
> = {
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
  primary: {
    bg: 'bg-primary/[0.06]',
    border: 'border-primary/30',
    bar: 'bg-primary',
    title: 'text-foreground',
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
  showBar?: boolean
  'data-testid'?: string
  nonCollapsible?: boolean
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
  nonCollapsible = false,
  'data-testid': testId,
}: TraeBlockProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed)
  const collapsed = collapsedProp ?? internalCollapsed
  const toneCls = TONE_CLS[tone]

  const onClick = () => {
    if (nonCollapsible) return
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
            aria-expanded={nonCollapsible ? undefined : !collapsed}
            disabled={nonCollapsible}
            className={cn(
              'flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] transition-colors',
              toneCls.title,
              !nonCollapsible && 'cursor-pointer hover:bg-accent/30',
              nonCollapsible && 'cursor-default',
            )}
          >
            {!nonCollapsible && (
              <ChevronRight
                className={cn(
                  'h-3 w-3 shrink-0 transition-transform duration-150',
                  !collapsed && 'rotate-90',
                )}
                aria-hidden
              />
            )}
            {icon && <span className="shrink-0">{icon}</span>}
            {title && <span className="flex-1 truncate font-medium">{title}</span>}
            {meta && <span className="shrink-0 text-[10px] opacity-80">{meta}</span>}
          </button>
        )}
        <div
          className="grid transition-[grid-template-rows] duration-150 ease-out"
          style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
        >
          <div className="overflow-hidden">
            {hasHeader && children && (
              <div className="border-t border-border/30 px-2 py-1.5">{children}</div>
            )}
            {!hasHeader && children && <div className="px-2 py-1.5">{children}</div>}
          </div>
        </div>
      </div>
    </div>
  )
})

export default TraeBlock