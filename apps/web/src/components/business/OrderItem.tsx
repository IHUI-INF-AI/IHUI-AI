'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/data'

type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refunded'

interface OrderItemProps {
  orderNo: string
  product: { name: string; image?: string; spec?: string; quantity?: number }
  amount: number | string
  status: OrderStatus
  createdAt?: string
  actions?: React.ReactNode
  onClick?: () => void
  className?: string
}

const statusMap: Record<OrderStatus, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  pending: { label: '待付款', variant: 'warning' },
  paid: { label: '已付款', variant: 'primary' },
  shipped: { label: '已发货', variant: 'primary' },
  completed: { label: '已完成', variant: 'success' },
  cancelled: { label: '已取消', variant: 'default' },
  refunded: { label: '已退款', variant: 'danger' },
}

export function OrderItem({
  orderNo,
  product,
  amount,
  status,
  createdAt,
  actions,
  onClick,
  className,
}: OrderItemProps) {
  const statusInfo = statusMap[status]
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card p-4 text-card-foreground shadow',
        onClick && 'cursor-pointer hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b pb-2 text-sm text-muted-foreground">
        <span>订单号: {orderNo}</span>
        <div className="flex items-center gap-2">
          {createdAt && <span className="text-xs">{createdAt}</span>}
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-3 py-3">
        {product.image && (
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{product.name}</p>
          {product.spec && <p className="text-sm text-muted-foreground">{product.spec}</p>}
          {product.quantity && <p className="text-sm text-muted-foreground">x{product.quantity}</p>}
        </div>
        <div className="text-right">
          <p className="font-bold text-primary">
            {typeof amount === 'number' ? `¥${amount.toFixed(2)}` : amount}
          </p>
        </div>
      </div>
      {actions && <div className="flex justify-end gap-2 border-t pt-2">{actions}</div>}
    </div>
  )
}
