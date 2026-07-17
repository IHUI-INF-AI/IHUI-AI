'use client'

import { useTranslations, useLocale } from 'next-intl'
import { ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DataTable, type Column } from '@/components/data'
import { Empty, Loading } from '@/components/common'
import { OrderItem } from '@/components/business'
import { STATUS_CONFIG } from './helpers'
import type { OrderRow } from './types'

interface Props {
  orders: OrderRow[]
  isLoading: boolean
  error: unknown
  view: 'table' | 'card'
}

export function OrdersList({ orders, isLoading, error, view }: Props) {
  const t = useTranslations('orders')
  const locale = useLocale()
  const currencyFmt = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const columns: Column<OrderRow>[] = [
    {
      key: 'orderNo',
      title: t('orderNo'),
      render: (o) => <span className="font-mono text-xs">{o.orderNo}</span>,
    },
    {
      key: 'targetTitle',
      title: t('target'),
      render: (o) => (
        <div>
          <div className="font-medium">{o.targetTitle ?? '-'}</div>
          <div className="text-xs text-muted-foreground">
            {t(`type.${o.orderType === 'course' ? 'course' : 'card'}`)}
          </div>
        </div>
      ),
    },
    {
      key: 'payAmount',
      title: t('amount'),
      render: (o) => <span className="font-medium">{currencyFmt.format(Number(o.payAmount))}</span>,
    },
    {
      key: 'status',
      title: t('statusLabel'),
      render: (o) => {
        const sc = STATUS_CONFIG[o.status]
        const StatusIcon = sc.icon
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
              sc.cls,
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {t(`status.${o.status}`)}
          </span>
        )
      },
    },
    {
      key: 'createdAt',
      title: t('createdAt'),
      render: (o) => (
        <span className="text-muted-foreground">{dateFmt.format(new Date(o.createdAt))}</span>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loading size="sm" text={t('loading')} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {(error as Error).message}
      </div>
    )
  }

  if (orders.length === 0) {
    return <Empty icon={ShoppingCart} title={t('empty')} />
  }

  if (view === 'table') {
    return <DataTable columns={columns} data={orders} rowKey={(o) => o.id} />
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <OrderItem
          key={o.id}
          orderNo={o.orderNo}
          product={{ name: o.targetTitle ?? '-' }}
          amount={Number(o.payAmount)}
          status={o.status}
          createdAt={dateFmt.format(new Date(o.createdAt))}
        />
      ))}
    </div>
  )
}
