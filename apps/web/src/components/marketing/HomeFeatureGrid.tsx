'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Award,
  Boxes,
  GraduationCap,
  Laptop,
  Lightbulb,
  ShieldCheck,
  Terminal,
  Zap,
  type LucideIcon,
} from 'lucide-react'

interface FeatureItem {
  icon: LucideIcon
  title: string
  description: string
}

interface AdvantageItem {
  icon: LucideIcon
  title: string
  description: string
}

export function HomeFeatureGrid() {
  const t = useTranslations('marketing.features')
  const ta = useTranslations('marketing.advantages')

  const features: FeatureItem[] = [
    {
      icon: Laptop,
      title: t('modelIntegration.title'),
      description: t('modelIntegration.description'),
    },
    {
      icon: Boxes,
      title: t('appStore.title'),
      description: t('appStore.description'),
    },
    {
      icon: Terminal,
      title: t('contentCreation.title'),
      description: t('contentCreation.description'),
    },
    {
      icon: GraduationCap,
      title: t('edu.title'),
      description: t('edu.description'),
    },
    {
      icon: ShieldCheck,
      title: t('navigation.title'),
      description: t('navigation.description'),
    },
  ]

  const advantages: AdvantageItem[] = [
    {
      icon: Award,
      title: ta('professional.title'),
      description: ta('professional.description'),
    },
    {
      icon: Zap,
      title: ta('efficient.title'),
      description: ta('efficient.description'),
    },
    {
      icon: ShieldCheck,
      title: ta('reliable.title'),
      description: ta('reliable.description'),
    },
    {
      icon: Lightbulb,
      title: ta('innovative.title'),
      description: ta('innovative.description'),
    },
  ]

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t('title')}</h2>
          <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
            {t('titleEn')}
          </h3>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t('subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-5">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 sm:p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="line-clamp-2 text-[11px] text-muted-foreground sm:text-xs">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{ta('title')}</h2>
          <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
            {ta('titleEn')}
          </h3>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
            {ta('subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {advantages.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-2 rounded-xl border bg-muted/40 p-3 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 sm:p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="line-clamp-2 text-[11px] text-muted-foreground sm:text-xs">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
