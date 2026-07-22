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
      <RevealOnView
        as="div"
        className="space-y-2"
      >
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t('title')}</h2>
          <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
            {t('titleEn')}
          </h3>
          <p className="mx-auto max-w-2xl text-xs text-muted-foreground sm:text-sm">
            {t('subtitle')}
          </p>
        </div>
      </RevealOnView>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {features.map(({ icon: Icon, title, description, benefit }, i) => (
          <RevealOnView
            key={title}
            delay={0.05 * (i + 1)}
            className="group relative flex flex-col items-center gap-1.5 overflow-hidden rounded-lg border bg-card p-3 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 sm:p-3.5"
          >
            {/* 卡片顶部渐变高光(hover 时显现) */}
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            {/* 图标背景圆 - 渐变背景 + hover 放大旋转 */}
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 to-emerald-500/10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
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
          </RevealOnView>
        ))}
      </div>

      <RevealOnView
        as="div"
        delay={0.1}
        className="space-y-2"
      >
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{ta('title')}</h2>
          <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
            {ta('titleEn')}
          </h3>
          <p className="mx-auto max-w-2xl text-xs text-muted-foreground sm:text-sm">
            {ta('subtitle')}
          </p>
        </div>
      </RevealOnView>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {advantages.map(({ icon: Icon, title, description, evidence }, i) => (
          <RevealOnView
            key={title}
            delay={0.15 + 0.05 * (i + 1)}
            className="group relative flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border bg-muted/40 p-3 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 sm:p-3.5"
          >
            {/* 卡片顶部渐变高光 */}
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            {/* 图标背景圆 - 渐变背景 + hover 放大旋转 */}
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-500/20 to-primary/10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
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
          </RevealOnView>
        ))}
      </div>
    </section>
  )
}
