'use client'

import * as React from 'react'
import { Folder, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface GroupCardItem {
  id: string
  name: string
  desc?: string
  apiCount?: number
  tag?: string
}

export interface GroupCardProps {
  group?: GroupCardItem
  onClick?: () => void
  className?: string
}

export default function GroupCard({
  group,
  onClick,
  className,
}: GroupCardProps): React.JSX.Element {
  const g = group ?? { id: '', name: '' }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left text-card-foreground shadow hover:shadow-md',
        className,
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Folder className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{g.name}</span>
          {g.tag && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {g.tag}
            </span>
          )}
        </div>
        {g.desc && <div className="truncate text-xs text-muted-foreground">{g.desc}</div>}
        {g.apiCount !== undefined && (
          <div className="mt-1 text-xs text-muted-foreground">{g.apiCount} 个接口</div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  )
}
