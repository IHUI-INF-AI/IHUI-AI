import * as React from 'react'
import { cn } from '@/lib/utils'

type SkeletonVariant = 'card' | 'list' | 'text' | 'avatar'

interface SkeletonProps {
  variant?: SkeletonVariant
  count?: number
  className?: string
}

export function Skeleton({ variant = 'text', count = 1, className }: SkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i)

  if (variant === 'card') {
    return (
      <div className={cn('space-y-3', className)}>
        {items.map((i) => (
          <div key={`skeleton-${i}`} className="rounded-xl border p-4 shadow">
            <div className="mb-3 h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>
            <div className="mt-4 flex gap-2">
              <div className="h-8 w-20 animate-pulse rounded bg-muted" />
              <div className="h-8 w-20 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-3', className)}>
        {items.map((i) => (
          <div key={`skeleton-${i}`} className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'avatar') {
    return (
      <div className={cn('flex gap-2', className)}>
        {items.map((i) => (
          <div key={`skeleton-${i}`} className="h-10 w-10 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((i) => (
        <div key={`skeleton-${i}`} className="h-4 w-full animate-pulse rounded bg-muted" />
      ))}
    </div>
  )
}
