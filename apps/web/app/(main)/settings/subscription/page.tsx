'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Crown, Check } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui'
import { Container } from '@/components/layout'

export default function SubscriptionPage() {
  const t = useTranslations('settings')

  const plans = [
    {
      key: 'monthly',
      name: t('planMonthly'),
      price: t('planMonthlyPrice'),
      features: t.raw('planMonthlyFeatures') as string[],
    },
    {
      key: 'yearly',
      name: t('planYearly'),
      price: t('planYearlyPrice'),
      features: t.raw('planYearlyFeatures') as string[],
    },
    {
      key: 'lifetime',
      name: t('planLifetime'),
      price: t('planLifetimePrice'),
      features: t.raw('planLifetimeFeatures') as string[],
    },
  ]

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('subscriptionTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subscriptionDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-4 w-4" />
            {t('currentPlan')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-lg font-semibold">VIP</p>
              <p className="text-sm text-muted-foreground">{t('planExpiry')}: 2026-12-31</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              {t('planActive')}
            </span>
          </div>
          <div className="flex gap-3">
            <Button>{t('renew')}</Button>
            <Button variant="outline">{t('cancelSubscription')}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2 pt-2">
        <h2 className="text-lg font-semibold tracking-tight">{t('planFeatures')}</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.key} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">{plan.name}</CardTitle>
              <p className="text-2xl font-bold">{plan.price}</p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <ul className="flex-1 space-y-2">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-green-600" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full">
                {t('subscribe')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </Container>
  )
}
