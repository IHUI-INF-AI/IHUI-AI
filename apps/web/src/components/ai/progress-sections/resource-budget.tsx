'use client'

import * as React from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ResourceBudgetVariant = 'inline' | 'block'

interface ResourceBudgetProps {
  used: number
  total: number
  label: string
  variant?: ResourceBudgetVariant
  active?: boolean
  className?: string
  'data-testid'?: string
}

export const ResourceBudget = React.memo(function ResourceBudget({
  used,
  total,
  label,
  variant = 'inline',
  active = false,
  className,
  'data-testid': testId,
}: ResourceBudgetProps) {
  const safeTotal = Math.max(0, total)
  const safeUsed = Math.max(0, Math.min(used, safeTotal))
  const pct = safeTotal > 0 ? Math.round((safeUsed / safeTotal) * 100) : 0
  const Icon = active ? Loader2 : Sparkles

  if (variant === 'block') {
    const fillCls = pct >= 90 ? 'bg-destructive/60' : pct >= 70 ? 'bg-amber-500/60' : 'bg-primary/60'
    return (
      <div
        className={cn('space-y-1', className)}
        data-testid={testId ?? 'resource-budget-block'}
        aria-label={`Current usage: ${safeUsed} / ${safeTotal} ${label}`}
      >
        <div className="flex items-center justify-between gap-1.5 text-[10px] text-muted-foreground/70">
          <span className="inline-flex items-center gap-0.5">
            <Icon
              className={cn('h-2.5 w-2.5', pct >= 70 ? 'text-amber-500' : 'text-primary', active && 'animate-spin')}
              aria-hidden
            />
            <span>
              Current usage: <span className="font-medium text-foreground/80">{safeUsed}</span>
              {' / '}
              {safeTotal} {label}
            </span>
          </span>
          <span className="shrink-0 tabular-nums">{pct}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted/40" aria-hidden>
          <div
            className={cn('h-full transition-all duration-300', fillCls)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] text-muted-foreground/60',
        className,
      )}
      data-testid={testId ?? 'resource-budget-inline'}
      aria-label={`Current usage: ${safeUsed} / ${safeTotal} ${label}`}
    >
      <Icon
        className={cn(
          'h-2.5 w-2.5',
          pct >= 70 ? 'text-amber-500' : 'text-primary',
          active && 'animate-spin',
        )}
        aria-hidden
      />
      <span className="tabular-nums">
        Current usage: {safeUsed} / {safeTotal} {label}
      </span>
    </span>
  )
})

export default ResourceBudget