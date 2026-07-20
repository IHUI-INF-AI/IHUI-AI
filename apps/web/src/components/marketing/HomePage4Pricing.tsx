'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, Sparkles } from 'lucide-react'
import { Button, Card } from '@ihui/ui'

interface PricingPlan {
  id: 'basic' | 'professional' | 'enterprise' | 'flagship'
  nameKey: string
  descKey: string
  price: number
  featureKeys: string[]
  recommended: boolean
  href: string
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'basic',
    nameKey: 'basic.name',
    descKey: 'basic.description',
    price: 588,
    recommended: false,
    href: '/enterprise',
    featureKeys: [
      'basic.feature1',
      'basic.feature2',
      'basic.feature3',
      'basic.feature4',
      'basic.feature5',
      'basic.feature6',
      'basic.feature7',
    ],
  },
  {
    id: 'professional',
    nameKey: 'professional.name',
    descKey: 'professional.description',
    price: 1990,
    recommended: true,
    href: '/enterprise',
    featureKeys: [
      'professional.feature1',
      'professional.feature2',
      'professional.feature3',
      'professional.feature4',
      'professional.feature5',
      'professional.feature6',
      'professional.feature7',
    ],
  },
  {
    id: 'enterprise',
    nameKey: 'enterprise.name',
    descKey: 'enterprise.description',
    price: 3888,
    recommended: false,
    href: '/enterprise',
    featureKeys: [
      'enterprise.feature1',
      'enterprise.feature2',
      'enterprise.feature3',
      'enterprise.feature4',
      'enterprise.feature5',
      'enterprise.feature6',
      'enterprise.feature7',
    ],
  },
  {
    id: 'flagship',
    nameKey: 'flagship.name',
    descKey: 'flagship.description',
    price: 4990,
    recommended: false,
    href: '/enterprise',
    featureKeys: [
      'flagship.feature1',
      'flagship.feature2',
      'flagship.feature3',
      'flagship.feature4',
      'flagship.feature5',
      'flagship.feature6',
      'flagship.feature7',
    ],
  },
]

export function HomePage4Pricing() {
  const t = useTranslations('marketing.pricing')

  return (
    // 2026-07-20 改:去掉 max-w-7xl mx-auto,容器改 w-full 撑满营销区域
    <section className="w-full px-4 py-12 sm:py-16">
      <div className="mb-8 text-center sm:mb-10">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h2>
        <h3 className="font-edix mt-1 text-xs uppercase tracking-wider text-muted-foreground">
          {t('titleEn')}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {PRICING_PLANS.map((plan) => {
          const isRecommended = plan.recommended
          return (
            <Card
              key={plan.id}
              className={
                isRecommended
                  ? 'relative flex flex-col overflow-hidden rounded-xl border-2 border-primary bg-card shadow-md transition-colors hover:border-primary/80 hover:bg-primary/5'
                  : 'relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5'
              }
            >
              {isRecommended && (
                <div className="absolute right-3 top-3 z-10">
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                    <Sparkles className="h-3 w-3" />
                    {t('recommended')}
                  </span>
                </div>
              )}

              <div className="flex flex-1 flex-col p-5">
                <div className="mb-3">
                  <h3 className="text-lg font-bold leading-tight tracking-tight">
                    {t(plan.nameKey)}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{t(plan.descKey)}</p>
                </div>

                <div className="mb-4 flex items-baseline gap-1">
                  <span className="text-base font-semibold text-muted-foreground">¥</span>
                  <span className="text-3xl font-bold leading-none tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">{t('period')}</span>
                </div>

                <ul className="mb-5 flex-1 space-y-2">
                  {plan.featureKeys.map((featureKey) => (
                    <li key={featureKey} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="text-muted-foreground">{t(featureKey)}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild className="w-full rounded-md">
                  <Link href={plan.href}>{t('cta')}</Link>
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
