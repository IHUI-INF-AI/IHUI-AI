'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Crown, Check, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface VipLevel {
  id: string
  levelName: string
  levelValue: number
  price: number
  durationDays: number
  benefits: string[]
  status: number
  sortOrder: number
}

type PaymentMethod = 'wechat' | 'alipay'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const formatCNY = (cents: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(cents / 100)

function DetailsContent() {
  const t = useTranslations('vip')
  const tc = useTranslations('common')
  const tp = useTranslations('payment')
  const searchParams = useSearchParams()
  const levelId = searchParams.get('levelId') ?? ''

  const [method, setMethod] = React.useState<PaymentMethod>('wechat')

  const METHODS: { id: PaymentMethod; label: string }[] = [
    { id: 'wechat', label: tp('checkout.wechat') },
    { id: 'alipay', label: tp('checkout.alipay') },
  ]

  const { data, isLoading, error } = useQuery({
    queryKey: ['vip-levels'],
    queryFn: () => api<{ items: VipLevel[] }>('/api/vip/levels'),
  })

  const levels = data?.items ?? []
  const level = levels.find((l) => l.id === levelId)

  const purchaseMut = useMutation({
    mutationFn: (input: { vipLevelId: string; paymentMethod: PaymentMethod }) =>
      api<{ orderId: string }>('/api/vip/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
  })

  const onSuccess = purchaseMut.isSuccess
  const benefits = level && Array.isArray(level.benefits) ? level.benefits : []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {(error as Error).message}
      </div>
    )
  }

  if (onSuccess) {
    return (
      <div className="mx-auto w-full max-w-md space-y-6 py-10 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h1 className="text-2xl font-bold tracking-tight">{t('purchaseSuccess')}</h1>
        <Button asChild>
          <Link href="/vip">{tc('back')}</Link>
        </Button>
      </div>
    )
  }

  if (!level) {
    return (
      <div className="mx-auto w-full max-w-md space-y-6 py-10 text-center">
        <Crown className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
        <Button asChild variant="outline">
          <Link href="/vip">{tc('back')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/vip"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tc('back')}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('details')}</h1>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{level.levelName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{formatCNY(level.price)}</span>
                <span className="text-sm text-muted-foreground">
                  {t('durationDays', { days: level.durationDays })}
                </span>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">{t('benefits')}</p>
                {benefits.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('empty')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('choosePlan')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {METHODS.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                    method === m.id ? 'border-primary bg-primary/5' : 'hover:bg-accent',
                  )}
                >
                  <input
                    type="radio"
                    name="method"
                    value={m.id}
                    checked={method === m.id}
                    onChange={() => setMethod(m.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="font-medium">{m.label}</span>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4 transition-opacity',
                      method === m.id ? 'opacity-100 text-primary' : 'opacity-0',
                    )}
                  />
                </label>
              ))}

              {purchaseMut.isError ? (
                <p className="pt-2 text-sm text-destructive">
                  {t('purchaseFail')}: {(purchaseMut.error as Error).message}
                </p>
              ) : null}

              <Button
                className="mt-4 w-full"
                size="lg"
                disabled={purchaseMut.isPending}
                onClick={() => purchaseMut.mutate({ vipLevelId: level.id, paymentMethod: method })}
              >
                {purchaseMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('subscribe')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function VipDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        </div>
      }
    >
      <DetailsContent />
    </Suspense>
  )
}
