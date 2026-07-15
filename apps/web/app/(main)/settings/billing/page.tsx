'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Receipt, ShoppingCart } from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ihui/ui'
import { Container } from '@/components/layout'
import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'
import type { Order } from '@/lib/order-api'

import { OrdersTab } from './OrdersTab'
import { InvoicesTab } from './InvoicesTab'
import { PAGE_SIZE } from './helpers'
import type { InvoiceApplication } from './types'

export default function BillingPage() {
  const t = useTranslations('settings')
  const locale = useLocale()
  const [tab, setTab] = React.useState<'orders' | 'invoices'>('orders')
  const [orderPage, setOrderPage] = React.useState(1)
  const [invoicePage, setInvoicePage] = React.useState(1)

  const currencyFmt = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' }),
    [locale],
  )
  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const ordersQuery = useQuery({
    queryKey: ['settings', 'billing', 'orders', orderPage],
    queryFn: async () => {
      const res = await fetchApi<PageData<Order>>(
        `/orders/me${buildQs({ page: orderPage, pageSize: PAGE_SIZE })}`,
      )
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: tab === 'orders',
  })

  const invoicesQuery = useQuery({
    queryKey: ['settings', 'billing', 'invoices', invoicePage],
    queryFn: async () => {
      const res = await fetchApi<PageData<InvoiceApplication>>(
        `/invoices/applications${buildQs({ page: invoicePage, pageSize: PAGE_SIZE })}`,
      )
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: tab === 'invoices',
  })

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('billingTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('billingDesc')}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'orders' | 'invoices')}>
        <TabsList>
          <TabsTrigger value="orders">{t('billingOrders')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('billingInvoices')}</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" />
                {t('billingOrders')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrdersTab
                t={t}
                list={ordersQuery.data?.list ?? []}
                isLoading={ordersQuery.isLoading}
                error={ordersQuery.error as Error | null}
                page={orderPage}
                total={ordersQuery.data?.total ?? 0}
                pageSize={PAGE_SIZE}
                currencyFmt={currencyFmt}
                dateFmt={dateFmt}
                onPageChange={setOrderPage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4" />
                {t('billingInvoices')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InvoicesTab
                t={t}
                list={invoicesQuery.data?.list ?? []}
                isLoading={invoicesQuery.isLoading}
                error={invoicesQuery.error as Error | null}
                page={invoicePage}
                total={invoicesQuery.data?.total ?? 0}
                pageSize={PAGE_SIZE}
                currencyFmt={currencyFmt}
                dateFmt={dateFmt}
                onPageChange={setInvoicePage}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Container>
  )
}
