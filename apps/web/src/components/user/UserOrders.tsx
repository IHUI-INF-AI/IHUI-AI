'use client'

import * as React from 'react'
import { ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UserOrder {
  id: string
  title: string
  amount?: number | string
  status?: string
  createdAt?: string
}

export interface UserOrdersProps {
  orders?: UserOrder[]
  onClick?: (id: string) => void
  className?: string
}

export default function UserOrders({
  orders = [],
  onClick,
  className,
}: UserOrdersProps): React.JSX.Element {
  if (orders.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border bg-card p-10 text-center',
          className,
        )}
      >
        <ShoppingBag className="mb-2 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">暂无订单</p>
      </div>
    )
  }
  return (
    <ul className={cn('divide-y rounded-xl border bg-card', className)}>
      {orders.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            onClick={() => onClick?.(o.id)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/50"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{o.title}</div>
              {o.createdAt && <div className="text-xs text-muted-foreground">{o.createdAt}</div>}
            </div>
            <div className="shrink-0 text-right">
              {o.amount !== undefined && <div className="text-sm font-medium">¥{o.amount}</div>}
              {o.status && <div className="text-xs text-muted-foreground">{o.status}</div>}
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
