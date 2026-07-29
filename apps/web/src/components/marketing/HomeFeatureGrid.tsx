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
import { RevealOnView } from '@/components/common'

interface FeatureItem {
  icon: LucideIcon
  title: string
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
    { icon: Laptop, title: t('modelIntegration.title'), benefit: t('modelIntegration.benefit') },
    { icon: Boxes, title: t('appStore.title'), benefit: t('appStore.benefit') },
    { icon: Terminal, title: t('contentCreation.title'), benefit: t('contentCreation.benefit') },
    { icon: GraduationCap, title: t('edu.title'), benefit: t('edu.benefit') },
    { icon: ShieldCheck, title: t('navigation.title'), benefit: t('navigation.benefit') },
    { icon: Bot, title: t('agentSquare.title'), benefit: t('agentSquare.benefit') },
    { icon: Workflow, title: t('workflow.title'), benefit: t('workflow.benefit') },
    { icon: FileImage, title: t('multimodal.title'), benefit: t('multimodal.benefit') },
  ]

  const advantages: AdvantageItem[] = [
    { icon: Award, title: ta('professional.title'), description: ta('professional.description'), evidence: ta('professional.evidence') },
    { icon: Zap, title: ta('efficient.title'), description: ta('efficient.description'), evidence: ta('efficient.evidence') },
    { icon: ShieldCheck, title: ta('reliable.title'), description: ta('reliable.description'), evidence: ta('reliable.evidence') },
    { icon: Lightbulb, title: ta('innovative.title'), description: ta('innovative.description'), evidence: ta('innovative.evidence') },
  ]

  return (
    <section className="space-y-8">
      {/* === 核心能力 === */}
      <RevealOnView as="div" className="space-y-2">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t('title')}</h2>
          <h3 className="font-edix text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t('titleEn')}
          </h3>
          <p className="mx-auto max-w-2xl text-xs text-muted-foreground sm:text-sm">
            {t('subtitle')}
          </p>
        </div>
      </RevealOnView>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {features.map(({ icon: Icon, title, benefit }, i) => (
          <RevealOnView
            key={title}
            delay={0.05 * (i + 1)}
            className="group relative flex flex-col items-center gap-3 overflow-hidden rounded-lg border bg-card p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 sm:p-6"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/12 text-primary transition-transform duration-300 group-hover:scale-110">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            <p className="text-[11px] font-medium leading-relaxed text-primary/80">
              {benefit}
            </p>
          </RevealOnView>
        ))}
      </div>

      {/* === 核心优势 === */}
      <RevealOnView as="div" delay={0.1} className="space-y-2">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{ta('title')}</h2>
          <h3 className="font-edix text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {ta('titleEn')}
          </h3>
          <p className="mx-auto max-w-2xl text-xs text-muted-foreground sm:text-sm">
            {ta('subtitle')}
          </p>
        </div>
      </RevealOnView>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {advantages.map(({ icon: Icon, title, description, evidence }, i) => (
          <RevealOnView
            key={title}
            delay={0.15 + 0.05 * (i + 1)}
            className="group relative flex flex-col items-center gap-3 overflow-hidden rounded-lg border bg-card p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 sm:p-6"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/12 text-primary transition-transform duration-300 group-hover:scale-110">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {description}
            </p>
            <p className="text-[10px] font-medium italic text-primary/60">
              {evidence}
            </p>
          </RevealOnView>
        ))}
      </div>
    </section>
  )
}
