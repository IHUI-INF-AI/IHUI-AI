import { Crown } from 'lucide-react'
import { cn } from '../lib/utils.js'

interface VipBadgeProps {
  className?: string
  size?: 'sm' | 'md'
  label?: string
}

export function VipBadge({ className, size = 'sm', label = 'VIP' }: VipBadgeProps) {
  const sizing = size === 'md' ? 'px-2.5 py-1 text-xs gap-1' : 'px-2 py-0.5 text-xs gap-0.5'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-amber-500/10 font-medium text-amber-600 dark:text-amber-500',
        sizing,
        className,
      )}
    >
      <Crown className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
      {label}
    </span>
  )
}
