'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Award,
  Boxes,
  GraduationCap,
  Lightbulb,
  Navigation,
  PenTool,
  ShieldCheck,
  Store,
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
      icon: Boxes,
      title: t('modelIntegration.title'),
      description: t('modelIntegration.description'),
    },
    {
      icon: Store,
      title: t('appStore.title'),
      description: t('appStore.description'),
    },
    {
      icon: PenTool,
      title: t('contentCreation.title'),
      description: t('contentCreation.description'),
    },
    {
      icon: GraduationCap,
      title: t('edu.title'),
      description: t('edu.description'),
    },
    {
      icon: Navigation,
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
    <section className="space-y-10">
      <div className="space-y-4">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t('title')}</h2>
          <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
            {t('titleEn')}
          </h3>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t('subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-3 rounded-lg border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 sm:p-5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{ta('title')}</h2>
          <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
            {ta('titleEn')}
          </h3>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
            {ta('subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {advantages.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-3 rounded-xl border bg-muted/40 p-4 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 sm:p-5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
