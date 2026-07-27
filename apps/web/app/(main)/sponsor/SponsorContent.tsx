'use client'

import * as React from 'react'
import { Heart, Check, Sparkles, Users, Code, Rocket } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Card } from '@ihui/ui-react'

const TIERS = [
  { id: 'bronze', emoji: '🥉', accent: false },
  { id: 'silver', emoji: '🥈', accent: false },
  { id: 'gold', emoji: '🥇', accent: true },
  { id: 'platinum', emoji: '💎', accent: false },
  { id: 'diamond', emoji: '🏆', accent: false },
] as const

const SPONSOR_LINK = 'https://github.com/sponsors/IHUI-INF-AI'

const REASONS = [
  { icon: Code, key: 'reasonOpen' },
  { icon: Rocket, key: 'reasonFast' },
  { icon: Users, key: 'reasonCommunity' },
  { icon: Sparkles, key: 'reasonIndependence' },
] as const

export function SponsorContent(): React.JSX.Element {
  const t = useTranslations('sponsor')

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Heart className="h-3.5 w-3.5 text-primary" />
          {t('heroBadge')}
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{t('heroTitle')}</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
          {t('heroSubtitle')}
        </p>
        <div className="pt-2">
          <Button size="lg" asChild>
            <a href={SPONSOR_LINK} target="_blank" rel="noopener noreferrer">
              {t('heroButton')}
            </a>
          </Button>
        </div>
      </section>

      {/* Why sponsor */}
      <section className="mt-16">
        <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
          {t('whyTitle')}
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {REASONS.map(({ icon: Icon, key }) => (
            <div key={key} className="rounded-2xl border bg-card p-6 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">{t(`${key}Title`)}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {t(`${key}Desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section className="mt-16">
        <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
          {t('tiersTitle')}
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TIERS.map(({ id, emoji, accent }) => (
            <Card
              key={id}
              className={`flex flex-col p-6 ${accent ? 'border-primary shadow-md' : ''}`}
            >
              <div className="text-3xl">{emoji}</div>
              <h3 className="mt-3 text-lg font-semibold">{t(`tiers.${id}.name`)}</h3>
              <div className="mt-2 text-2xl font-bold text-primary">
                {t(`tiers.${id}.price`)}
              </div>
              <ul className="mt-4 space-y-2">
                {[1, 2, 3].map((n) => (
                  <li key={n} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{t(`tiers.${id}.feature${n}`)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-1 items-end">
                <Button asChild className="w-full" variant={accent ? 'default' : 'outline'}>
                  <a href={SPONSOR_LINK} target="_blank" rel="noopener noreferrer">
                    {t('becomeSponsor')}
                  </a>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Existing sponsors */}
      <section className="mt-16 rounded-2xl border bg-card p-8 text-center md:p-12">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t('sponsorsTitle')}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
          {t('sponsorsDesc')}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {['A', 'B', 'C', 'D'].map((initial) => (
            <div
              key={initial}
              className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary"
            >
              {initial}
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">{t('sponsorsEmpty')}</p>
      </section>
    </main>
  )
}
