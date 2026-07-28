'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Users, Activity, Zap, Building2 } from 'lucide-react'
import { AnimatedNumber } from '@/components/common'
import { Card, CardContent } from '@ihui/ui-react'

interface Metric {
  icon: React.ComponentType<{ className?: string }>
  value: number
  decimals?: number
  suffix?: string
  labelKey: string
}

const METRICS: Metric[] = [
  { icon: Users, value: 12847, labelKey: 'socialProof.registered' },
  { icon: Activity, value: 3294, labelKey: 'socialProof.monthlyActive' },
  { icon: Zap, value: 5.2, decimals: 1, suffix: 'M', labelKey: 'socialProof.apiCalls' },
  { icon: Building2, value: 87, labelKey: 'socialProof.enterprise' },
]

export function SocialProof(): React.JSX.Element {
  const t = useTranslations('pricingPage')

  return (
    <section className="mx-auto mt-14 max-w-5xl text-center">
      <h2 className="text-xl font-bold tracking-tight md:text-2xl">
        {t('socialProof.title')}
      </h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
        {t('socialProof.subtitle')}
      </p>
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {METRICS.map(({ icon: Icon, value, decimals, suffix, labelKey }) => (
          <Card key={labelKey} className="border-border">
            <CardContent className="flex flex-col items-center gap-2 p-5">
              <Icon className="h-5 w-5 text-primary" />
              <div className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                <AnimatedNumber value={value} decimals={decimals ?? 0} suffix={suffix ?? ''} />
              </div>
              <div className="text-xs text-muted-foreground md:text-sm">{t(labelKey)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
