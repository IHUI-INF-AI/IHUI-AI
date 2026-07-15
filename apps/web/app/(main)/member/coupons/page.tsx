'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Ticket, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

type CouponStatus = 'unused' | 'used' | 'expired'

interface Coupon {
  id: string
  code: string
  name: string
  amount: number
  minSpend: number
  status: CouponStatus
  expiresAt: string
}

const TABS: { value: CouponStatus; label: string }[] = [
  { value: 'unused', label: '未使用' },
  { value: 'used', label: '已使用' },
  { value: 'expired', label: '已过期' },
]

const STATUS_CLS: Record<CouponStatus, string> = {
  unused: 'border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/10',
  used: 'border-muted bg-muted/20 opacity-70',
  expired: 'border-muted bg-muted/20 opacity-70',
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberCouponsPage() {
  const locale = useLocale()
  const [tab, setTab] = React.useState<CouponStatus>('unused')

  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'coupons', tab],
    queryFn: () =>
      api<{ list: Coupon[] }>(`/api/coupons?status=${tab}`)
        .then((d) => d.list ?? [])
        .catch(() => [] as Coupon[]),
  })

  const coupons = data ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const currencyFmt = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Ticket className="h-5 w-5 text-primary" />
          优惠券
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">管理你的优惠券,下单时自动可用</p>
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Ticket className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">暂无优惠券</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {coupons.map((c) => (
            <div
              key={c.id}
              className={cn('flex items-center gap-3 rounded-lg border p-3', STATUS_CLS[c.status])}
            >
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
                <span className="text-lg font-bold">
                  {c.amount > 0 ? currencyFmt.format(c.amount) : '折扣'}
                </span>
                <span className="text-xs">元</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  满 {currencyFmt.format(c.minSpend)} 可用
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  有效期至:{dateFmt.format(new Date(c.expiresAt))}
                </p>
                <p className="font-mono text-xs text-muted-foreground">CODE: {c.code}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
