import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type LoadingVariant = 'spinner' | 'skeleton' | 'dots'

interface LoadingProps {
  variant?: LoadingVariant
  size?: 'sm' | 'md' | 'lg'
  className?: string
  text?: string
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
}

export function Loading({ variant = 'spinner', size = 'md', className, text }: LoadingProps) {
  if (variant === 'skeleton') {
    return (
      <div className={cn('w-full space-y-2', className)}>
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (variant === 'dots') {
    const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-3 w-3' : 'h-2 w-2'
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn('animate-bounce rounded-full bg-current', dotSize)}
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        {text && <span className="text-sm text-muted-foreground">{text}</span>}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-muted-foreground', sizeMap[size])} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  )
}
