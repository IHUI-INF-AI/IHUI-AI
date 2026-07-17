import * as React from 'react'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  showLabel?: boolean
  label?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
}

const sizeMap = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
}

const variantMap = {
  default: 'bg-primary',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
}

export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  label,
  size = 'md',
  variant = 'default',
  className,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  const currentVariant = percentage >= 100 ? 'success' : percentage >= 70 ? 'warning' : variant

  return (
    <div className={cn('w-full', className)}>
      {(showLabel || label) && (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          {showLabel && <span className="font-medium">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={cn('w-full overflow-hidden rounded-md bg-muted', sizeMap[size])}>
        <div
          className={cn(
            'h-full rounded-md transition-all duration-300',
            variantMap[currentVariant],
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
