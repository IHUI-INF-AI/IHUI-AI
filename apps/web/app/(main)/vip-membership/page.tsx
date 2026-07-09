'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Crown, Check, Loader2, Sparkles } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface PlanItem {
  id: string
  name: string
  description?: string | null
  price: number
  interval: string
  features: string[]
  sortOrder: number
}
interface PlansData {
  plans: PlanItem[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const formatCNY = (n: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n)

const intervalLabel = (interval: string, t: (k: string) => string) => {
  if (interval === 'year') return t('perYear')
  if (interval === 'month') return t('perMonth')
  return `/${interval}`
}

export default function VipMembershipPage() {
  const t = useTranslations('vip')

  const { data, isLoading, error } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api<PlansData>('/api/plans'),
  })

  const plans = data?.plans ?? []
  // 高亮中间方案(或 sortOrder 最大的)作为推荐
  const popularIdx = plans.length > 1 ? Math.floor(plans.length / 2) : 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Crown className="h-7 w-7 text-amber-500" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <Crown className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          {plans.map((plan, idx) => {
            const isPopular = idx === popularIdx
            const features = Array.isArray(plan.features) ? plan.features : []
            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative flex flex-col transition-shadow',
                  isPopular && 'border-amber-500/50 shadow-lg lg:scale-105',
                )}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-white shadow">
                    <Sparkles className="mr-1 inline h-3 w-3" />
                    {t('popular')}
                  </span>
                )}
                <CardHeader className="p-6 pb-3">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {plan.description && (
                    <CardDescription className="text-sm">{plan.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col p-6 pt-0">
                  <div className="mb-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{formatCNY(plan.price)}</span>
                    <span className="text-sm text-muted-foreground">
                      {intervalLabel(plan.interval, t)}
                    </span>
                  </div>

                  {features.length > 0 && (
                    <ul className="mb-6 space-y-2 text-sm">
                      {features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto pt-4">
                    <Link href={`/payment/checkout?plan=${plan.id}`}>
                      <Button
                        className="w-full"
                        variant={isPopular ? 'default' : 'outline'}
                      >
                        {plan.price === 0 ? t('startFree') : t('subscribe')}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        {t('faqHint')}
      </div>
    </div>
  )
}
