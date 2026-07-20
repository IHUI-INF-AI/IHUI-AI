'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Award,
  Bot,
  Boxes,
  FileImage,
  GraduationCap,
  Laptop,
  Lightbulb,
  ShieldCheck,
  Terminal,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'

interface FeatureItem {
  icon: LucideIcon
  title: string
  description: string
  benefit: string
}

interface AdvantageItem {
  icon: LucideIcon
  title: string
  description: string
  evidence: string
}

export function HomeFeatureGrid() {
  const t = useTranslations('marketing.features')
  const ta = useTranslations('marketing.advantages')

  const features: FeatureItem[] = [
    {
      icon: Laptop,
      title: t('modelIntegration.title'),
      description: t('modelIntegration.description'),
      benefit: t('modelIntegration.benefit'),
    },
    {
      icon: Boxes,
      title: t('appStore.title'),
      description: t('appStore.description'),
      benefit: t('appStore.benefit'),
    },
    {
      icon: Terminal,
      title: t('contentCreation.title'),
      description: t('contentCreation.description'),
      benefit: t('contentCreation.benefit'),
    },
    {
      icon: GraduationCap,
      title: t('edu.title'),
      description: t('edu.description'),
      benefit: t('edu.benefit'),
    },
    {
      icon: ShieldCheck,
      title: t('navigation.title'),
      description: t('navigation.description'),
      benefit: t('navigation.benefit'),
    },
    {
      icon: Bot,
      title: t('agentSquare.title'),
      description: t('agentSquare.description'),
      benefit: t('agentSquare.benefit'),
    },
    {
      icon: Workflow,
      title: t('workflow.title'),
      description: t('workflow.description'),
      benefit: t('workflow.benefit'),
    },
    {
      icon: FileImage,
      title: t('multimodal.title'),
      description: t('multimodal.description'),
      benefit: t('multimodal.benefit'),
    },
  ]

  const advantages: AdvantageItem[] = [
    {
      icon: Award,
      title: ta('professional.title'),
      description: ta('professional.description'),
      evidence: ta('professional.evidence'),
    },
    {
      icon: Zap,
      title: ta('efficient.title'),
      description: ta('efficient.description'),
      evidence: ta('efficient.evidence'),
    },
    {
      icon: ShieldCheck,
      title: ta('reliable.title'),
      description: ta('reliable.description'),
      evidence: ta('reliable.evidence'),
    },
    {
      icon: Lightbulb,
      title: ta('innovative.title'),
      description: ta('innovative.description'),
      evidence: ta('innovative.evidence'),
    },
  ]

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t('title')}</h2>
          <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
            {t('titleEn')}
          </h3>
          <p className="mx-auto max-w-2xl text-xs text-muted-foreground sm:text-sm">
            {t('subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {features.map(({ icon: Icon, title, description, benefit }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 sm:p-3.5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold leading-tight sm:text-sm">{title}</h3>
                <p className="line-clamp-2 text-[10px] text-muted-foreground sm:text-[11px]">
                  {description}
                </p>
                <p className="line-clamp-2 rounded bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary sm:text-[11px]">
                  {benefit}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{ta('title')}</h2>
          <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
            {ta('titleEn')}
          </h3>
          <p className="mx-auto max-w-2xl text-xs text-muted-foreground sm:text-sm">
            {ta('subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {advantages.map(({ icon: Icon, title, description, evidence }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-1.5 rounded-xl border bg-muted/40 p-3 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 sm:p-3.5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold leading-tight sm:text-sm">{title}</h3>
                <p className="line-clamp-2 text-[10px] text-muted-foreground sm:text-[11px]">
                  {description}
                </p>
                <p className="mt-1 line-clamp-2 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] italic text-muted-foreground/80 sm:text-[11px]">
                  {evidence}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
