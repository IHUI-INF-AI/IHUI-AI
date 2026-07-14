'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { CreditCard, Loader2, ArrowUp, RefreshCw, Check } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface PlanInfo {
  id: string
  name: string
  price: number
  period: string
  features: string[]
  isCurrent?: boolean
}

interface SubscriptionData {
  planName?: string
  planId?: string
  price?: number
  period?: string
  features?: string[]
  expireAt?: string
  quotaUsed?: number
  quotaTotal?: number
  availablePlans?: PlanInfo[]
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function SubscriptionPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const currencyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['developer', 'subscription'],
    queryFn: () =>
      api<SubscriptionData>('/api/developer/subscription').catch(() => ({}) as SubscriptionData),
  })

  const renewMut = useMutation({
    mutationFn: () => api('/api/developer/subscription/renew', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'subscription'] })
      toast.success('续费成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const upgradeMut = useMutation({
    mutationFn: (planId: string) =>
      api('/api/developer/subscription/upgrade', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'subscription'] })
      toast.success('套餐已升级')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const plans = data?.availablePlans ?? []
  const quotaPct =
    data?.quotaTotal && data.quotaTotal > 0
      ? Math.min(100, ((data.quotaUsed ?? 0) / data.quotaTotal) * 100)
      : 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <CreditCard className="h-5 w-5 text-primary" />
          订阅管理
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">管理当前套餐与续费升级</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : (
        <>
          {data?.planName && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">当前套餐</p>
                    <p className="mt-0.5 text-lg font-semibold">{data.planName}</p>
                    {data.price !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        {currencyFmt.format(data.price)} / {data.period ?? '月'}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => renewMut.mutate()}
                    disabled={renewMut.isPending}
                  >
                    {renewMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    续费
                  </Button>
                </div>

                {data.expireAt && (
                  <p className="text-xs text-muted-foreground">
                    到期时间: {dateFmt.format(new Date(data.expireAt))}
                  </p>
                )}

                {data.quotaTotal !== undefined && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">配额使用</span>
                      <span className="font-medium">
                        {data.quotaUsed ?? 0} / {data.quotaTotal}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${quotaPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {data.features && data.features.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t pt-2">
                    {data.features.map((f) => (
                      <span
                        key={f}
                        className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        <Check className="h-3 w-3" />
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {plans.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">可升级套餐</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((p) => (
                  <Card key={p.id} className={cn(p.isCurrent && 'border-primary bg-primary/5')}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{p.name}</p>
                        {p.isCurrent && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                            当前
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-bold">
                        {currencyFmt.format(p.price)}
                        <span className="text-xs font-normal text-muted-foreground">
                          {' '}
                          / {p.period}
                        </span>
                      </p>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-center gap-1">
                            <Check className="h-3 w-3 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {!p.isCurrent && (
                        <Button
                          size="sm"
                          className="w-full"
                          variant="outline"
                          onClick={() => upgradeMut.mutate(p.id)}
                          disabled={upgradeMut.isPending}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                          升级
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
