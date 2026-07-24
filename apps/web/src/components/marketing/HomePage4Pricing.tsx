'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, Sparkles } from 'lucide-react'
import { Button, Card } from '@ihui/ui-react'
import { RevealOnView } from '@/components/common'

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
    ],
  },
]

export function HomePage4Pricing() {
  const t = useTranslations('marketing.pricing')

  return (
    // 2026-07-20 改:去掉 max-w-7xl mx-auto,容器改 w-full 撑满营销区域
    <section className="w-full px-4 py-4 sm:py-6">
      <RevealOnView as="div" className="mb-4 text-center sm:mb-5">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t('title')}</h2>
        <h3 className="font-edix mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {t('titleEn')}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t('subtitle')}</p>
      </RevealOnView>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
        {PRICING_PLANS.map((plan, i) => {
          const isRecommended = plan.recommended
          return (
            <RevealOnView
              key={plan.id}
              delay={0.05 * (i + 1)}
              className="group h-full"
            >
              <Card
                className={
                  isRecommended
                    ? 'relative flex h-full flex-col overflow-hidden rounded-xl border-2 border-primary bg-card p-4 shadow-lg shadow-primary/20 transition-all duration-300 animate-pulse-glow-light group-hover:-translate-y-2 group-hover:border-primary group-hover:bg-primary/5 group-hover:shadow-xl group-hover:shadow-primary/30'
                    : 'relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:bg-primary/5 group-hover:shadow-lg group-hover:shadow-primary/10'
                }
              >
                {/* 卡片顶部渐变高光(所有卡片 hover 时显现) */}
                <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                {/* 推荐计划专属:顶部强光晕 */}
                {isRecommended && (
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />
                )}
                {isRecommended && (
                  <div className="absolute right-2 top-2 z-10">
                    <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-primary to-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-md shadow-primary/30">
                      <Sparkles className="h-3 w-3" />
                      {t('recommended')}
                    </span>
                  </div>
                )}

                <div className="mb-2">
                  <h3 className="text-base font-bold leading-tight tracking-tight">
                    {t(plan.nameKey)}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{t(plan.descKey)}</p>
                </div>

                <div className="mb-3 flex items-baseline gap-1">
                  <span className="text-sm font-semibold text-muted-foreground">¥</span>
                  <span className={
                    isRecommended
                      ? 'bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-2xl font-bold leading-none tracking-tight text-transparent'
                      : 'text-2xl font-bold leading-none tracking-tight'
                  }>
                    {plan.price}
                  </span>
                  <span className="text-xs text-muted-foreground">{t('period')}</span>
                </div>

                <ul className="mb-3 flex-1 space-y-1.5">
                  {plan.featureKeys.map((featureKey) => (
                    <li key={featureKey} className="flex items-start gap-1.5 text-xs">
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                      <span className="text-muted-foreground">{t(featureKey)}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild className="w-full rounded-md" size="sm">
                  <Link href={plan.href}>{t('cta')}</Link>
                </Button>
              </Card>
            </RevealOnView>
          )
        })}
      </div>
    </section>
  )
}
