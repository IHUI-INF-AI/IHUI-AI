'use client'

import * as React from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
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

const statusVariantMap: Record<
  OrderStatus,
  { variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' }
> = {
  pending: { variant: 'warning' },
  paid: { variant: 'primary' },
  shipped: { variant: 'primary' },
  completed: { variant: 'success' },
  cancelled: { variant: 'default' },
  refunded: { variant: 'danger' },
}

function OrderItemImpl({
  orderNo,
  product,
  amount,
  status,
  createdAt,
  actions,
  onClick,
  className,
}: OrderItemProps) {
  const t = useTranslations('common')
  const statusInfo = statusVariantMap[status]
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        'rounded-xl border bg-card p-4 text-card-foreground shadow',
        onClick && 'cursor-pointer hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b pb-2 text-sm text-muted-foreground">
        <span>
          {t('orderNoLabel')}: {orderNo}
        </span>
        <div className="flex items-center gap-2">
          {createdAt && <span className="text-xs">{createdAt}</span>}
          <Badge variant={statusInfo.variant}>{t(`orderStatus.${status}`)}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-3 py-3">
        {product.image && (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
            <Image src={product.image} alt={product.name} fill className="object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium">{product.name}</p>
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

export const OrderItem = React.memo(OrderItemImpl)
