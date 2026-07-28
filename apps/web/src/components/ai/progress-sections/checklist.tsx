'use client'

import * as React from 'react'
import { AlertCircle, Check, Circle, Loader2, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChecklistItemData {
  id: string
  label: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed'
  meta?: React.ReactNode
  description?: React.ReactNode
}

interface ChecklistProps {
  items: ChecklistItemData[]
  dense?: boolean
  className?: string
  'data-testid'?: string
}

const STATUS_ICON: Record<
  ChecklistItemData['status'],
  React.ComponentType<{ className?: string }>
> = {
  pending: Circle,
  in_progress: Loader2,
  completed: Check,
  skipped: Minus,
  failed: AlertCircle,
}

const STATUS_CLS: Record<ChecklistItemData['status'], string> = {
  pending: 'text-muted-foreground/50',
  in_progress: 'text-primary',
  completed: 'text-emerald-500',
  skipped: 'text-muted-foreground/40',
  failed: 'text-destructive',
}

export const Checklist = React.memo(function Checklist({
  items,
  dense = false,
  className,
  'data-testid': testId,
}: ChecklistProps) {
  if (items.length === 0) return null
  return (
    <ul className={cn('space-y-0.5', className)} data-testid={testId ?? 'checklist'}>
      {items.map((item) => {
        const Icon = STATUS_ICON[item.status]
        return (
          <li
            key={item.id}
            className={cn('flex items-start gap-1.5', dense ? 'py-0.5' : 'py-1')}
            aria-label={item.label}
          >
            <Icon
              className={cn(
                'mt-0.5 h-3 w-3 shrink-0 transition-colors',
                STATUS_CLS[item.status],
                item.status === 'in_progress' && 'animate-spin',
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  'flex items-center gap-1.5 text-[11px] leading-snug',
                  item.status === 'completed' && 'text-muted-foreground/70',
                  item.status === 'skipped' && 'text-muted-foreground/40 line-through',
                  item.status === 'pending' && 'text-muted-foreground/70',
                  item.status === 'in_progress' && 'text-foreground/90',
                )}
              >
                <span className="flex-1 break-all">{item.label}</span>
                {item.meta && (
                  <span className="shrink-0 text-[10px] text-muted-foreground/60">{item.meta}</span>
                )}
              </div>
              {item.description && (
                <div className="mt-0.5 text-[10px] text-muted-foreground/60">
                  {item.description}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
})

export default Checklist
