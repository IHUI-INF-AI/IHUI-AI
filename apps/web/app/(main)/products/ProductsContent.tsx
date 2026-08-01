'use client'

import * as React from 'react'
import {
  FileText,
  Package,
  BookOpen,
  Code2,
  GraduationCap,
  Wrench,
  Check,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Card, Badge } from '@ihui/ui-react'

const PRODUCTS = [
  { id: 1, icon: FileText, popular: false },
  { id: 2, icon: Package, popular: true },
  { id: 3, icon: BookOpen, popular: false },
  { id: 4, icon: Code2, popular: false },
  { id: 5, icon: GraduationCap, popular: false },
  { id: 6, icon: Wrench, popular: false },
] as const

export function ProductsContent(): React.JSX.Element {
  const t = useTranslations('products')

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <ShoppingBag className="h-3.5 w-3.5 text-primary" />
          {t('heroBadge')}
        </div>
        <h1 className="text-2xl min-[768px]:text-3xl min-[1024px]:text-5xl font-bold tracking-tight">{t('heroTitle')}</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground min-[768px]:text-lg">
          {t('heroSubtitle')}
        </p>
      </section>

      {/* Product cards */}
      <section className="mt-12 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-3">
        {PRODUCTS.map(({ id, icon: Icon, popular }) => {
          const title = t(`cards.${id}.title`)
          const mailto = `mailto:business@aizhs.top?subject=${encodeURIComponent(
            `${t('buySubject')} ${title}`,
          )}`
          return (
            <Card key={id} className="relative flex flex-col p-6">
              {popular && (
                <Badge className="absolute right-4 top-4">{t('popular')}</Badge>
              )}
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <div className="mt-2 text-2xl font-bold text-primary">
                {t(`cards.${id}.price`)}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t(`cards.${id}.desc`)}</p>
              <ul className="mt-4 space-y-2">
                {[1, 2, 3].map((n) => (
                  <li key={n} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{t(`cards.${id}.feature${n}`)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-1 items-end">
                <Button asChild className="w-full">
                  <a href={mailto}>{t('buyNow')}</a>
                </Button>
              </div>
            </Card>
          )
        })}
      </section>

      {/* CTA */}
      <section className="mt-16 rounded-2xl border bg-primary/5 p-8 text-center min-[768px]:p-12">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">{t('ctaTitle')}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
          {t('ctaDesc')}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <a href={`mailto:business@aizhs.top?subject=${encodeURIComponent(t('ctaButton'))}`}>
              {t('ctaButton')}
            </a>
          </Button>
        </div>
      </section>
    </main>
  )
}
