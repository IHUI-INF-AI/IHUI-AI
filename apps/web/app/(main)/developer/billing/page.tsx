'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Receipt, Loader2, Download, CreditCard, Plus } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button } from '@ihui/ui'
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

const STATUS_CONFIG: Record<BillItem['status'], { label: string; cls: string }> = {
  paid: { label: '已支付', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  pending: { label: '待支付', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  failed: { label: '失败', cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
}

const PAYMENT_LABEL: Record<PaymentMethod['type'], string> = {
  alipay: '支付宝',
  wechat: '微信支付',
  card: '银行卡',
}

export default function BillingPage() {
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
      toast.info('发票生成中,请稍后')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Receipt className="h-5 w-5 text-primary" />
          账单
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">查看账单记录与付款方式</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="h-4 w-4" />
              付款方式
            </p>
            <Button size="sm" variant="outline" onClick={() => toast.info('请联系客服添加')}>
              <Plus className="h-3.5 w-3.5" />
              添加
            </Button>
          </div>
          {paymentMethods.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">暂无付款方式</p>
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
                  <span className="font-medium">{PAYMENT_LABEL[p.type]}</span>
                  {p.last4 && <span className="text-muted-foreground">**** {p.last4}</span>}
                  {p.isDefault && (
                    <span className="rounded bg-primary/10 px-1 py-0.5 text-xs text-primary">
                      默认
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
          <div className="border-b px-4 py-2.5 text-sm font-semibold">账单记录</div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : bills.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无账单记录</p>
          ) : (
            <div className="divide-y">
              {bills.map((b) => {
                const cfg = STATUS_CONFIG[b.status]
                return (
                  <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{b.invoiceNo}</p>
                        <span
                          className={cn('rounded px-1.5 py-0.5 text-xs font-medium', cfg.cls)}
                        >
                          {cfg.label}
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
                      发票
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
