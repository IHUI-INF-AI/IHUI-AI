import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, Zap, Building2 } from 'lucide-react'
import type { ComponentType } from 'react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Plan {
  id: 'free' | 'pro' | 'enterprise'
  icon: ComponentType<{ className?: string }>
  highlighted: boolean
  price: number
  ctaKey: string
}

const PLANS: Plan[] = [
  { id: 'free', icon: Check, highlighted: false, price: 0, ctaKey: 'plans.free.cta' },
  { id: 'pro', icon: Zap, highlighted: true, price: 99, ctaKey: 'plans.pro.cta' },
  { id: 'enterprise', icon: Building2, highlighted: false, price: 0, ctaKey: 'plans.enterprise.cta' },
]

const formatCNY = (n: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n)

export default function PaymentPage() {
  const t = useTranslations('payment')

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        {PLANS.map((plan) => {
          const Icon = plan.icon
          const features = t.raw(`plans.${plan.id}.features`) as string[]
          const isEnterprise = plan.id === 'enterprise'
          const priceLabel = isEnterprise ? t('plans.enterprise.contactSales') : formatCNY(plan.price)

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative flex flex-col transition-colors',
                plan.highlighted
                  ? 'border-primary shadow-md lg:scale-105'
                  : 'hover:border-primary/40',
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  {t('popular')}
                </span>
              )}
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{t(`plans.${plan.id}.name`)}</CardTitle>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight">{priceLabel}</span>
                  {!isEnterprise && (
                    <span className="text-sm text-muted-foreground">{t('perMonth')}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <ul className="flex-1 space-y-2">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={isEnterprise ? '/payment/checkout' : `/payment/checkout?plan=${plan.id}`}
                  className="block"
                >
                  <Button
                    variant={plan.highlighted ? 'default' : 'outline'}
                    className="w-full"
                  >
                    {t(plan.ctaKey)}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
