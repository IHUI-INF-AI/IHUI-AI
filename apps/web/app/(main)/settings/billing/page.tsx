'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, ChevronLeft, ChevronRight, Receipt, ShoppingCart } from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ihui/ui'
import { Container } from '@/components/layout'
import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'
import type { Order } from '@/lib/order-api'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-500',
  refunding: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  refunded: 'bg-primary/10 text-primary',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-500',
  processing: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  issued: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  rejected: 'bg-rose-500/10 text-rose-600 dark:text-rose-500',
}

interface InvoiceApplication {
  id: string
  invoiceNo: string
  type: string
  amount: string
  status: string
  appliedAt: string
}

const thCls = 'px-4 py-2.5 font-medium'
const tdCls = 'px-4 py-2.5'

function StatusBadge({
  status,
  prefix,
  t,
}: {
  status: string
  prefix: string
  t: (k: string) => string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_CLS[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {t(`${prefix}.${status}`)}
    </span>
  )
}

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

  const renderState = (
    isLoading: boolean,
    error: Error | null,
    isEmpty: boolean,
    colSpan: number,
    Icon: React.ComponentType<{ className?: string }>,
  ) => {
    if (isLoading)
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-10 text-center text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            {t('billingLoading')}
          </td>
        </tr>
      )
    if (error)
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-10 text-center text-destructive">
            {error.message}
          </td>
        </tr>
      )
    if (isEmpty)
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-10 text-center text-muted-foreground">
            <Icon className="mx-auto mb-2 h-8 w-8 opacity-40" />
            {t('billingNoData')}
          </td>
        </tr>
      )
    return null
  }

  const renderPagination = (page: number, total: number, setPage: (p: number) => void) => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    return (
      <div className="flex items-center justify-between pt-3">
        <span className="text-sm text-muted-foreground">{t('billingTotal', { count: total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(Math.max(1, page - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('billingPrev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('billingPageInfo', { page, totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            {t('billingNext')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

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
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className={thCls}>{t('billingOrderNo')}</th>
                      <th className={thCls}>{t('billingAmount')}</th>
                      <th className={thCls}>{t('billingStatus')}</th>
                      <th className={thCls}>{t('billingCreatedAt')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {renderState(
                      ordersQuery.isLoading,
                      ordersQuery.error,
                      (ordersQuery.data?.list ?? []).length === 0,
                      4,
                      ShoppingCart,
                    )}
                    {(ordersQuery.data?.list ?? []).map((o) => (
                      <tr key={o.id} className="transition-colors hover:bg-muted/30">
                        <td className={cn(tdCls, 'font-mono text-xs')}>{o.orderNo}</td>
                        <td className={cn(tdCls, 'font-medium')}>
                          {currencyFmt.format(Number(o.payAmount))}
                        </td>
                        <td className={tdCls}>
                          <StatusBadge status={o.status} prefix="billingOrderStatus" t={t} />
                        </td>
                        <td className={cn(tdCls, 'text-muted-foreground')}>
                          {dateFmt.format(new Date(o.createdAt))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {renderPagination(orderPage, ordersQuery.data?.total ?? 0, setOrderPage)}
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
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className={thCls}>{t('billingInvoiceNo')}</th>
                      <th className={thCls}>{t('billingInvoiceType')}</th>
                      <th className={thCls}>{t('billingAmount')}</th>
                      <th className={thCls}>{t('billingStatus')}</th>
                      <th className={thCls}>{t('billingCreatedAt')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {renderState(
                      invoicesQuery.isLoading,
                      invoicesQuery.error,
                      (invoicesQuery.data?.list ?? []).length === 0,
                      5,
                      Receipt,
                    )}
                    {(invoicesQuery.data?.list ?? []).map((inv) => (
                      <tr key={inv.id} className="transition-colors hover:bg-muted/30">
                        <td className={cn(tdCls, 'font-mono text-xs')}>{inv.invoiceNo}</td>
                        <td className={tdCls}>{t(`billingInvoiceTypeValue.${inv.type}`)}</td>
                        <td className={cn(tdCls, 'font-medium')}>
                          {currencyFmt.format(Number(inv.amount))}
                        </td>
                        <td className={tdCls}>
                          <StatusBadge status={inv.status} prefix="billingInvoiceStatus" t={t} />
                        </td>
                        <td className={cn(tdCls, 'text-muted-foreground')}>
                          {dateFmt.format(new Date(inv.appliedAt))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {renderPagination(invoicePage, invoicesQuery.data?.total ?? 0, setInvoicePage)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Container>
  )
}
