'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { ShoppingCart, RotateCcw, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OrdersTab } from './OrdersTab'
import { RefundsTab } from './RefundsTab'
import { InvoicesTab } from './InvoicesTab'

type Tab = 'orders' | 'refunds' | 'invoices'

export default function AdminOrdersPage() {
  const t = useTranslations('admin.orders')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [tab, setTab] = React.useState<Tab>('orders')

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const currencyFmt = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {(
          [
            { value: 'orders', icon: ShoppingCart, label: t('tabOrders') },
            { value: 'refunds', icon: RotateCcw, label: t('tabRefunds') },
            { value: 'invoices', icon: FileText, label: t('tabInvoices') },
          ] as { value: Tab; icon: React.ComponentType<{ className?: string }>; label: string }[]
        ).map((tb) => (
          <button
            key={tb.value}
            onClick={() => setTab(tb.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === tb.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <tb.icon className="h-4 w-4" />
            {tb.label}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-in fade-in-0 duration-200">
        {tab === 'orders' && <OrdersTab t={t} dateFmt={dateFmt} currencyFmt={currencyFmt} />}
        {tab === 'refunds' && (
          <RefundsTab t={t} tc={tc} dateFmt={dateFmt} currencyFmt={currencyFmt} />
        )}
        {tab === 'invoices' && (
          <InvoicesTab t={t} tc={tc} dateFmt={dateFmt} currencyFmt={currencyFmt} />
        )}
      </div>
    </div>
  )
}
