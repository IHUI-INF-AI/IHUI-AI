'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Check, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui'
import { fetchApi } from '@/lib/api'

export interface Plan {
  name: string
  price: string
  originalPrice?: string
  period: string
  desc: string
  features: string[]
  cta: string
  ctaHref: string
  highlighted?: boolean
}

interface PricingSettingsResponse {
  list: Array<{
    key: string
    value?: string | null
  }>
}

async function fetchPlans(): Promise<Plan[]> {
  const r = await fetchApi<PricingSettingsResponse>(`/api/settings/pricing`)
  if (!r.success || !r.data?.list?.length) {
    throw new Error('pricing settings not configured')
  }
  // 后端 settings 表的 key/value 可编码任意定价结构
  // 约定:value 是 JSON 字符串,反序列化为 Plan
  const plans: Plan[] = []
  for (const item of r.data.list) {
    if (!item.value) continue
    try {
      const parsed = JSON.parse(item.value) as Partial<Plan>
      if (parsed.name && parsed.price) {
        plans.push({
          name: parsed.name,
          price: parsed.price,
          originalPrice: parsed.originalPrice,
          period: parsed.period ?? '',
          desc: parsed.desc ?? '',
          features: parsed.features ?? [],
          cta: parsed.cta ?? 'Learn More',
          ctaHref: parsed.ctaHref ?? '/support',
          highlighted: parsed.highlighted,
        })
      }
    } catch {
      // 非 JSON value,跳过
    }
  }
  return plans
}

export function PricingContent(): React.JSX.Element {
  const t = useTranslations('pricingPage')

  const fallbackPlans: Plan[] = [
    {
      name: t('earlyBird.name'),
      price: t('earlyBird.price'),
      originalPrice: t('earlyBird.originalPrice'),
      period: t('earlyBird.period'),
      desc: t('earlyBird.desc'),
      features: t.raw('earlyBird.features') as string[],
      cta: t('earlyBird.cta'),
      ctaHref: '/support?source=pricing',
      highlighted: true,
    },
    {
      name: t('standard.name'),
      price: t('standard.price'),
      period: t('standard.period'),
      desc: t('standard.desc'),
      features: t.raw('standard.features') as string[],
      cta: t('standard.cta'),
      ctaHref: '/support?source=pricing-standard',
    },
    {
      name: t('enterprise.name'),
      price: t('enterprise.price'),
      period: t('enterprise.period'),
      desc: t('enterprise.desc'),
      features: t.raw('enterprise.features') as string[],
      cta: t('enterprise.cta'),
      ctaHref: '/contact?source=pricing-enterprise',
    },
  ]

  const { data, isLoading } = useQuery({
    queryKey: ['pricing'],
    queryFn: fetchPlans,
    retry: false,
    // 降级:API 失败时使用静态方案
    placeholderData: fallbackPlans,
  })

  const plans = data?.length ? data : fallbackPlans

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t('hero.badge')}
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{t('hero.title')}</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
          {t('hero.subtitle')}
        </p>
      </section>

      {/* 定价卡片 */}
      <section className="mt-16 grid gap-6 md:grid-cols-3">
        {isLoading && (
          <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        )}
        {!isLoading &&
          plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md ${
                plan.highlighted ? 'border-primary ring-2 ring-primary/20' : ''
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  {t('badge')}
                </div>
              )}
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{plan.desc}</p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-primary md:text-4xl">
                  {plan.price}
                </span>
                {plan.originalPrice && (
                  <span className="text-sm text-muted-foreground line-through">
                    {plan.originalPrice}
                  </span>
                )}
                {plan.period && (
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                )}
              </div>
              <ul className="mt-6 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                variant={plan.highlighted ? 'default' : 'outline'}
                asChild
                className="mt-6 w-full"
              >
                <Link href={plan.ctaHref}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
      </section>

      {/* 退款保障 */}
      <section className="mt-12 rounded-2xl border bg-primary/5 p-6 text-center md:p-8">
        <h2 className="text-lg font-semibold">{t('refundTitle')}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          {t('refundDesc')}
        </p>
      </section>
    </main>
  )
}
