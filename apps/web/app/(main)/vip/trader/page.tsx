'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Crown, Check, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

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

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const formatCNY = (cents: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(cents / 100)

export default function VipTraderPage() {
  const t = useTranslations('vip')
  const tc = useTranslations('common')

  const { data, isLoading, error } = useQuery({
    queryKey: ['vip-levels'],
    queryFn: () => api<{ items: VipLevel[] }>('/api/vip/levels'),
  })

  const levels = data?.items ?? []
  // 操盘手方案：levelValue 最高的等级
  let level: VipLevel | undefined
  for (const l of levels) {
    if (!level || l.levelValue > level.levelValue) level = l
  }

  const purchaseMut = useMutation({
    mutationFn: (vipLevelId: string) =>
      api<{ orderId: string }>('/api/vip/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vipLevelId, paymentMethod: 'wechat' }),
      }),
  })

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

  if (purchaseMut.isSuccess) {
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

  const benefits = Array.isArray(level.benefits) ? level.benefits : []

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/vip"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tc('back')}
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Crown className="h-7 w-7 text-amber-500" />
          {t('traderPlan')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card className="border-amber-500/40">
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
                  <li key={`benefit-${i}`} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            )}
          </div>

          {purchaseMut.isError ? (
            <p className="text-sm text-destructive">
              {t('purchaseFail')}: {(purchaseMut.error as Error).message}
            </p>
          ) : null}

          <Button
            className="w-full"
            size="lg"
            disabled={purchaseMut.isPending}
            onClick={() => purchaseMut.mutate(level.id)}
          >
            {purchaseMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('subscribe')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
