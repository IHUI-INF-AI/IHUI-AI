'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Shield, Lock, Github } from 'lucide-react'
import { Card, CardContent } from '@ihui/ui-react'

interface GuaranteeItem {
  icon: React.ComponentType<{ className?: string }>
  titleKey: string
  descKey: string
}

const ITEMS: GuaranteeItem[] = [
  { icon: Shield, titleKey: 'guarantee.refundTitle', descKey: 'guarantee.refundDesc' },
  { icon: Lock, titleKey: 'guarantee.dataTitle', descKey: 'guarantee.dataDesc' },
  { icon: Github, titleKey: 'guarantee.openSourceTitle', descKey: 'guarantee.openSourceDesc' },
]

export function Guarantee(): React.JSX.Element {
  const t = useTranslations('pricingPage')

  return (
    <section className="mx-auto mt-14 max-w-5xl">
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-tight md:text-2xl">
          {t('guarantee.title')}
        </h2>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {ITEMS.map(({ icon: Icon, titleKey, descKey }) => (
          <Card key={titleKey} className="border-border">
            <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
              <Icon className="h-7 w-7 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t(titleKey)}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{t(descKey)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
