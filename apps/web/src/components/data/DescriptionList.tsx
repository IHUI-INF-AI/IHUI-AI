import * as React from 'react'
import { cn } from '@/lib/utils'

export interface DescriptionItem {
  label: string
  value: React.ReactNode
}

interface DescriptionListProps {
  items: DescriptionItem[]
  column?: 1 | 2 | 3
  className?: string
}

const colMap = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
}

export function DescriptionList({ items, column = 2, className }: DescriptionListProps) {
  return (
    <dl className={cn('grid gap-x-4 gap-y-3', colMap[column], className)}>
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="text-sm font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
