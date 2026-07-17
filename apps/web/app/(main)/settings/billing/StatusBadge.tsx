'use client'

import { cn } from '@/lib/utils'
import { STATUS_CLS } from './helpers'

interface Props {
  status: string
  prefix: string
  t: (k: string) => string
}

export function StatusBadge({ status, prefix, t }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        STATUS_CLS[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {t(`${prefix}.${status}`)}
    </span>
  )
}
