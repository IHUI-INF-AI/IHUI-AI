'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ShoppingCart } from 'lucide-react'
import { OrdersFilter } from './OrdersFilter'
import { OrdersList } from './OrdersList'
import { OrdersPagination } from './OrdersPagination'
import { PAGE_SIZE, fetchOrders } from './helpers'

export default function OrdersPage() {
  const t = useTranslations('orders')
  const [status, setStatus] = React.useState('all')
  const [orderType, setOrderType] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [view, setView] = React.useState<'table' | 'card'>('table')

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', 'me', status, orderType, page],
    queryFn: () => fetchOrders({ page, status, orderType }),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <ShoppingCart className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <OrdersFilter
        status={status}
        setStatus={(v) => {
          setStatus(v)
          setPage(1)
        }}
        orderType={orderType}
        setOrderType={(v) => {
          setOrderType(v)
          setPage(1)
        }}
        view={view}
        setView={setView}
      />

      <OrdersList orders={data?.list ?? []} isLoading={isLoading} error={error} view={view} />

      <OrdersPagination total={total} page={page} totalPages={totalPages} setPage={setPage} />
    </div>
  )
}
