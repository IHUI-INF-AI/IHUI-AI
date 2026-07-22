'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CreditCard, Loader2, CheckCircle, XCircle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface Subscription {
  id: string
  planName: string
  status: 'active' | 'cancelled' | 'expired'
  startTime: string
  endTime: string
  amount: string
  autoRenew: boolean
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_CLS: Record<Subscription['status'], string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  cancelled: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
}

export default function MemberSubscriptionPage() {
  const locale = useLocale()
  const t = useTranslations('memberSubscriptionPage')
  const router = useRouter()
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'subscription'],
    queryFn: () =>
      api<{ subscription: Subscription | null }>('/api/subscriptions')
        .then((d) => d.subscription)
        .catch(() => null),
  })

  const cancelMut = useMutation({
    mutationFn: () => api('/api/subscriptions/cancel', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', 'subscription'] }),
  })
  const renewMut = useMutation({
    mutationFn: () => api('/api/subscriptions/renew', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', 'subscription'] }),
  })

  const sub = data
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
          <CreditCard className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : !sub ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <CreditCard className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">{t('noSubscription')}</p>
          <Button onClick={() => router.push('/vip')}>{t('subscribeNow')}</Button>
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold">{sub.planName}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateFmt.format(new Date(sub.startTime))} ~{' '}
                    {dateFmt.format(new Date(sub.endTime))}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-medium',
                    STATUS_CLS[sub.status],
                  )}
                >
                  {t(`status.${sub.status}`)}
                </span>
              </div>

              <div className="flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">{t('subscriptionAmount')}</span>
                <span className="font-semibold">{currencyFmt.format(Number(sub.amount))}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('autoRenew')}</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1',
                    sub.autoRenew
                      ? 'text-emerald-600 dark:text-emerald-500'
                      : 'text-muted-foreground',
                  )}
                >
                  {sub.autoRenew ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {sub.autoRenew ? t('autoRenewOn') : t('autoRenewOff')}
                </span>
              </div>
            </CardContent>
          </Card>

          {sub.status === 'active' && (
            <div className="flex gap-3">
              <Button onClick={() => renewMut.mutate()} disabled={renewMut.isPending}>
                {renewMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {t('renewNow')}
              </Button>
              <Button
                variant="outline"
                onClick={() => cancelMut.mutate()}
                disabled={cancelMut.isPending}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {cancelMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {t('cancelSubscription')}
              </Button>
            </div>
          )}

          {cancelMut.isError && (
            <Alert variant="danger" description={(cancelMut.error as Error).message} />
          )}
          {renewMut.isError && (
            <Alert variant="danger" description={(renewMut.error as Error).message} />
          )}
        </>
      )}
    </div>
  )
}
