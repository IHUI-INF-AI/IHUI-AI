import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TimelineItem {
  title: string
  description?: string
  time?: string
  icon?: React.ComponentType<{ className?: string }>
  color?: string
}

interface TimelineProps {
  items: TimelineItem[]
  mode?: 'left' | 'right' | 'alternate'
  className?: string
}

export function Timeline({ items, mode = 'left', className }: TimelineProps) {
  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'absolute top-0 bottom-0 w-px bg-border',
          mode === 'left' && 'left-3',
          mode === 'right' && 'right-3',
        )}
      />
      <div className="space-y-4">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.title}
              className={cn('relative flex gap-3', mode === 'right' && 'flex-row-reverse')}
            >
              <div
                className={cn(
                  'z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-background',
                )}
                style={{ backgroundColor: item.color ?? 'var(--primary)' }}
              >
                {Icon && <Icon className="h-3 w-3 text-white" />}
              </div>
              <div className={cn('flex-1 pt-0.5', mode === 'right' && 'text-right')}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.title}</span>
                  {item.time && <span className="text-xs text-muted-foreground">{item.time}</span>}
                </div>
                {item.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
