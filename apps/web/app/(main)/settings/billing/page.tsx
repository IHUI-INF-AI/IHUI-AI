// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
} from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'
import { getDailyCreditsUsage, type Order } from '@ihui/api-client'
import { CreditsHeatmapCard } from '@/components/billing/credits-heatmap-card'

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

  // 按日积分消耗热力图(§D64 卡不取数,数据面 = GET /api/credits/usage/daily,UTC 分桶缺日补零)
  const dailyUsageQuery = useQuery({
    queryKey: ['settings', 'billing', 'credits-usage-daily'],
    queryFn: async () => {
      const res = await getDailyCreditsUsage({ days: 90 })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })
  const heatmapDayCounts = React.useMemo(() => {
    const buckets = dailyUsageQuery.data?.buckets
    if (!buckets || buckets.length === 0) return undefined
    return Object.fromEntries(buckets.map((b) => [b.date, b.count] as const))
  }, [dailyUsageQuery.data])

  return (
    <div className="px-4 space-y-4 py-4">
      <BackButton />
      {/* 无数据时不渲染空壳卡片(卡内契约:dayCounts 缺省 → null;外层同步收起) */}
      {heatmapDayCounts ? (
        <Card>
          <CardContent>
            <CreditsHeatmapCard
              dayCounts={heatmapDayCounts}
              data-testid="settings-credits-heatmap"
            />
          </CardContent>
        </Card>
      ) : null}
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
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
