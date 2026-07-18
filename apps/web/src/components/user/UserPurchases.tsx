'use client'

import * as React from 'react'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UserPurchase {
  id: string
  title: string
  price?: number | string
  quantity?: number
  purchasedAt?: string
}

export interface UserPurchasesProps {
  items?: UserPurchase[]
  onClick?: (id: string) => void
  className?: string
}

export default function UserPurchases({
  items = [],
  onClick,
  className,
}: UserPurchasesProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border bg-card p-10 text-center',
          className,
        )}
      >
        <Package className="mb-2 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">暂无购买记录</p>
      </div>
    )
  }
  return (
    <ul className={cn('divide-y rounded-xl border bg-card', className)}>
      {items.map((it) => (
        <li key={it.id}>
          <button
            type="button"
            onClick={() => onClick?.(it.id)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/50"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{it.title}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {it.quantity !== undefined && <span>x{it.quantity}</span>}
                {it.purchasedAt && <span>{it.purchasedAt}</span>}
              </div>
            </div>
            {it.price !== undefined && (
              <div className="shrink-0 text-sm font-medium">¥{it.price}</div>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
