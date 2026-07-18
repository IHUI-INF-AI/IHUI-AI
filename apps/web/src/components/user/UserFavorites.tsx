'use client'

import * as React from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UserFavoriteItem {
  id: string
  title: string
  desc?: string
  cover?: string
}

export interface UserFavoritesProps {
  items?: UserFavoriteItem[]
  onRemove?: (id: string) => void
  onClick?: (id: string) => void
  className?: string
}

export default function UserFavorites({
  items = [],
  onRemove,
  onClick,
  className,
}: UserFavoritesProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border bg-card p-10 text-center',
          className,
        )}
      >
        <Star className="mb-2 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">暂无收藏</p>
      </div>
    )
  }
  return (
    <ul className={cn('divide-y rounded-xl border bg-card', className)}>
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => onClick?.(it.id)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="truncate text-sm font-medium">{it.title}</div>
            {it.desc && <div className="truncate text-xs text-muted-foreground">{it.desc}</div>}
          </button>
          <button
            type="button"
            onClick={() => onRemove?.(it.id)}
            className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
          >
            取消收藏
          </button>
        </li>
      ))}
    </ul>
  )
}
