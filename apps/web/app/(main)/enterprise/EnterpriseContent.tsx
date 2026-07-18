'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Target, Users, Globe, Bot, ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui'
import { AnimatedNumber } from '@/components/common'
import { HeroCarousel } from '@/components/marketing/HeroCarousel'
import { Marquee } from '@/components/marketing/Marquee'
import { NewsSection } from '@/components/marketing/NewsSection'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { ArchitectureSection } from './sections/ArchitectureSection'
import { CompassSection } from './sections/CompassSection'
import { CoursesSection } from './sections/CoursesSection'
import { ToolsSection } from './sections/ToolsSection'

/**
 * enterprise 页专属 HeroCarousel slides 配置
 * - CTA 跳转目标避开自指(不再跳回 /enterprise),改为咨询/支持等
 * - 文案来自 enterprise.carousel 命名空间,与营销首页分离
 */
const ENTERPRISE_SLIDES = [
  {
    titleKey: 'slide1Title',
    subtitleKey: 'slide1Subtitle',
    ctaKey: 'slide1Cta',
    href: '/support?source=enterprise',
    gradient: 'from-primary/85 via-primary/65 to-emerald-400/50',
  },
  {
    titleKey: 'slide2Title',
    subtitleKey: 'slide2Subtitle',
    ctaKey: 'slide2Cta',
    href: '/circles',
    gradient: 'from-violet-600/80 via-purple-500/60 to-indigo-400/45',
  },
  {
    titleKey: 'slide3Title',
    subtitleKey: 'slide3Subtitle',
    ctaKey: 'slide3Cta',
    href: '/agents',
    gradient: 'from-sky-600/80 via-blue-500/60 to-cyan-400/45',
  },
  {
    titleKey: 'slide4Title',
    subtitleKey: 'slide4Subtitle',
    ctaKey: 'slide4Cta',
    href: '/support?source=enterprise&type=seat',
    gradient: 'from-rose-600/80 via-pink-500/60 to-orange-400/45',
  },
  {
    titleKey: 'slide5Title',
    subtitleKey: 'slide5Subtitle',
    ctaKey: 'slide5Cta',
    href: '/support?source=enterprise&type=refund',
    gradient: 'from-emerald-600/80 via-teal-500/60 to-green-400/45',
  },
]

interface ModuleItem {
  tag: string
  title: string
  description: string
  features: string[]
}

const MODULE_ICONS = [Users, Globe, Bot]
const MODULE_FEATURED = [false, false, true]

export function EnterpriseContent() {
  const t = useTranslations('enterprise')
  const router = useRouter()
  const handleJoin = () => router.push('/support?source=enterprise')

  const modules = t.raw('modules.items') as ModuleItem[]
  const benefits = t.raw('join.benefits') as string[]
  const positioningTags = t.raw('positioning.tags') as string[]

  return (
    <>
      <div className="mx-auto w-full max-w-5xl space-y-10 py-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t('header.backHome')}
            </Link>
          </Button>
          <span className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {t('header.badge')}
          </span>
        </div>

        {/* 跑马灯 */}
        <Marquee />

        {/* Hero 轮播 + 5 指示器(使用 enterprise 命名空间文案,CTA 不自指) */}
        <HeroCarousel slides={ENTERPRISE_SLIDES} namespace="enterprise.carousel" />

        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span className="h-px w-8 bg-border" />
            {t('hero.brandLabel')}
            <span className="h-px w-8 bg-border" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t('hero.title')}</h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
            {t('hero.subtitle')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
            <div className="text-center">
              <div className="text-2xl font-bold tracking-tight">
                <AnimatedNumber value={18000} prefix="¥" duration={2000} />
              </div>
              <div className="text-xs text-muted-foreground">{t('hero.priceStandard')}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold tracking-tight text-primary">
                  <AnimatedNumber value={6000} prefix="¥" duration={2000} />
                </span>
                <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  -67%
                </span>
              </div>
              <div className="text-xs text-muted-foreground">{t('hero.priceEarlyBird')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold tracking-tight">
                <AnimatedNumber value={18} duration={1500} />
              </div>
              <div className="text-xs text-muted-foreground">{t('hero.earlyBirdSlots')}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button size="lg" onClick={handleJoin}>
              {t('hero.joinNow')}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/agents">
                <Sparkles className="mr-1 h-4 w-4" />
                {t('hero.exploreAgents')}
              </Link>
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('positioning.label')}
          </div>
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:gap-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Target className="h-7 w-7" />
              </div>
              <div className="flex-1 space-y-2">
                <h2 className="text-lg font-semibold tracking-tight">{t('positioning.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('positioning.description')}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {positioningTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border bg-muted/50 px-3 py-1 text-xs font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('modules.label')}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {modules.map((m, i) => {
              const Icon = MODULE_ICONS[i] ?? Users
              return (
                <Card
                  key={m.title}
                  className={`relative transition-colors hover:bg-accent ${
                    MODULE_FEATURED[i] ? 'border-primary/40' : ''
                  }`}
                >
                  {MODULE_FEATURED[i] && (
                    <span className="absolute right-3 top-3 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                      {t('modules.coreServiceBadge')}
                    </span>
                  )}
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{m.tag}</span>
                    </div>
                    <h3 className="text-base font-semibold tracking-tight">{m.title}</h3>
                    <p className="text-sm text-muted-foreground">{m.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {m.features.map((f) => (
                        <span key={f} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                          {f}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <ArchitectureSection />

        <CompassSection />

        <CoursesSection />

        <ToolsSection />

        {/* 资讯区 */}
        <NewsSection />

        <section className="space-y-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('join.label')}
          </div>
          <Card className="overflow-hidden border-primary/20">
            <CardContent className="space-y-5 p-6">
              <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold tracking-tight">{t('join.title')}</h2>
                  <p className="text-sm text-muted-foreground">{t('join.subtitle')}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground line-through">¥18000</div>
                  <div className="text-3xl font-bold tracking-tight text-primary">¥6000</div>
                  <div className="text-xs text-muted-foreground">{t('join.perYear')}</div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {benefits.map((b) => (
                  <div key={b} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-success" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button size="lg" onClick={handleJoin}>
                  {t('join.joinNow')}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">{t('join.consultHint')}</span>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* 全站页脚(含品牌信息、链接列、二维码、支付图标、版权) */}
      <SiteFooter />
    </>
  )
}
