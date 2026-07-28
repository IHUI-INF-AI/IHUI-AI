'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface CompressionDividerProps {
  count: number
  expandable?: boolean
  onExpand?: () => void
  label?: string
  className?: string
  'data-testid'?: string
}

export const CompressionDivider = React.memo(function CompressionDivider({
  count,
  expandable = true,
  onExpand,
  label,
  className,
  'data-testid': testId,
}: CompressionDividerProps) {
  if (count <= 0) return null
  const text = label ?? `${count} 条已折叠`

  if (!expandable || !onExpand) {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-1.5 py-2 text-[10px] text-muted-foreground/50',
          className,
        )}
        data-testid={testId ?? 'compression-divider'}
        role="separator"
        aria-label={text}
      >
        <span className="h-px flex-1 bg-border/50" aria-hidden />
        <span>{text}</span>
        <span className="h-px flex-1 bg-border/50" aria-hidden />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onExpand}
      className={cn(
        'group flex w-full items-center justify-center gap-1.5 py-2 text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground',
        className,
      )}
      data-testid={testId ?? 'compression-divider'}
      aria-label={`${text},点击展开`}
    >
      <span
        className="h-px flex-1 bg-border/50 transition-colors group-hover:bg-border"
        aria-hidden
      />
      <span className="shrink-0 font-medium">{text}</span>
      <span className="shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-y-0.5">
        ▼
      </span>
      <span
        className="h-px flex-1 bg-border/50 transition-colors group-hover:bg-border"
        aria-hidden
      />
    </button>
  )
})

export default CompressionDivider
