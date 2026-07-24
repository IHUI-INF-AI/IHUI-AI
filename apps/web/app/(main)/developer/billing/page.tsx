'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Receipt, Loader2, Download, CreditCard, Plus } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface BillItem {
  id: string
  invoiceNo: string
  amount: number
  period: string
  status: 'paid' | 'pending' | 'failed'
  createdAt: string
  invoiceUrl?: string
}

interface PaymentMethod {
  id: string
  type: 'alipay' | 'wechat' | 'card'
  label: string
  isDefault?: boolean
  last4?: string
}

interface BillingData {
  bills: BillItem[]
  paymentMethods: PaymentMethod[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_CLASS: Record<BillItem['status'], string> = {
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

export default function BillingPage() {
  const t = useTranslations('developerBillingPage')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const currencyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['developer', 'billing'],
    queryFn: () =>
      api<BillingData>('/api/developer/billing').catch(
        () => ({ bills: [], paymentMethods: [] }) as BillingData,
      ),
  })

  const bills = data?.bills ?? []
  const paymentMethods = data?.paymentMethods ?? []

  function downloadInvoice(b: BillItem) {
    if (b.invoiceUrl) {
      window.open(b.invoiceUrl, '_blank')
    } else {
      toast.info(t('toastInvoiceGenerating'))
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Receipt className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="h-4 w-4" />
              {t('paymentMethods')}
            </p>
            <Button size="sm" variant="outline" onClick={() => toast.info(t('toastContactSupport'))}>
              <Plus className="h-3.5 w-3.5" />
              {t('add')}
            </Button>
          </div>
          {paymentMethods.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">{t('noPaymentMethods')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {paymentMethods.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
                    p.isDefault && 'border-primary bg-primary/5',
                  )}
                >
                  <span className="font-medium">{t(`payType.${p.type}`)}</span>
                  {p.last4 && <span className="text-muted-foreground">**** {p.last4}</span>}
                  {p.isDefault && (
                    <span className="rounded bg-primary/10 px-1 py-0.5 text-xs text-primary">
                      {t('default')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">{t('billRecords')}</div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : bills.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('noBills')}</p>
          ) : (
            <div className="divide-y">
              {bills.map((b) => {
                const cls = STATUS_CLASS[b.status]
                return (
                  <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{b.invoiceNo}</p>
                        <span
                          className={cn('rounded px-1.5 py-0.5 text-xs font-medium', cls)}
                        >
                          {t(`status.${b.status}`)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {b.period} · {dateFmt.format(new Date(b.createdAt))}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium">
                      {currencyFmt.format(b.amount)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadInvoice(b)}
                      disabled={b.status !== 'paid'}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t('invoice')}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
