import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Shadcn 标准 Skeleton 组件(首屏加载占位)。
 *
 * 用法:
 * - `<Skeleton className="h-8 w-full" />` 行级占位
 * - `<Skeleton variant="table-row" rows={5} />` 表格行占位
 * - `<Skeleton variant="card" />` 卡片占位
 */
type SkeletonVariant = 'default' | 'text' | 'avatar' | 'card' | 'table-row' | 'list' | 'stat'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant
  rows?: number
}

function PulseLine({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

export function Skeleton({ variant = 'default', rows = 1, className, ...props }: SkeletonProps) {
  if (variant === 'table-row') {
    return (
      <div className={cn('space-y-2', className)} {...props}>
        {Array.from({ length: rows }, (_, i) => (
          <PulseLine key={`sk-r-${i}`} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-3', className)} {...props}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={`sk-l-${i}`} className="flex items-center gap-3">
            <PulseLine className="h-10 w-10 shrink-0" />
            <div className="flex-1 space-y-2">
              <PulseLine className="h-4 w-1/3" />
              <PulseLine className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className={cn('space-y-3 rounded-xl border p-4', className)} {...props}>
        <PulseLine className="h-4 w-1/3" />
        <div className="space-y-2">
          <PulseLine className="h-4 w-full" />
          <PulseLine className="h-4 w-2/3" />
        </div>
        <div className="mt-2 flex gap-2">
          <PulseLine className="h-8 w-20" />
          <PulseLine className="h-8 w-20" />
        </div>
      </div>
    )
  }

  if (variant === 'stat') {
    return (
      <div className={cn('rounded-xl border bg-card p-4', className)} {...props}>
        <div className="flex items-center justify-between">
          <PulseLine className="h-3 w-20" />
          <PulseLine className="h-8 w-8" />
        </div>
        <PulseLine className="mt-3 h-7 w-28" />
      </div>
    )
  }

  if (variant === 'avatar') {
    return <PulseLine className={cn('h-10 w-10 rounded-md', className)} {...props} />
  }

  if (variant === 'text' || rows > 1) {
    return (
      <div className={cn('space-y-2', className)} {...props}>
        {Array.from({ length: rows }, (_, i) => (
          <PulseLine key={`sk-t-${i}`} className="h-4 w-full" />
        ))}
      </div>
    )
  }

  return <PulseLine className={cn('h-4 w-full', className)} {...props} />
}

export { Skeleton as default }
