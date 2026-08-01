'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ShoppingCart } from 'lucide-react'
import { BackButton } from '@/components/common'
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
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex min-w-0 items-center gap-2 text-xl font-bold tracking-tight min-[768px]:text-2xl">
          <ShoppingCart className="h-7 w-7 shrink-0 text-primary" />
          <span className="truncate">{t('title')}</span>
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
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
