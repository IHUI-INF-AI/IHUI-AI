'use client'

import * as React from 'react'
import { Check, Globe, ShieldCheck, Users, Zap } from 'lucide-react'
import { AnimatedNumber, RevealOnView } from '@/components/common'
import { Marquee } from '@/components/marketing/Marquee'
import { GithubStarBanner } from '@/components/marketing/GithubStarBanner'
import { BrandMarquee } from '@/components/marketing/BrandMarquee'
import { HomeFeatureGrid } from '@/components/marketing/HomeFeatureGrid'
import { HomeScenarios } from '@/components/marketing/HomeScenarios'
import { HomeRoi } from '@/components/marketing/HomeRoi'
import { HomeComparison } from '@/components/marketing/HomeComparison'
import { HomePage3Magazine } from '@/components/marketing/HomePage3Magazine'
import { HomePage4Pricing } from '@/components/marketing/HomePage4Pricing'
import { TypewriterHeroSection } from '@/components/marketing/TypewriterHero'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { useTranslations } from 'next-intl'

/** 营销/工作区首页共用的 7-section 内容
 *
 * 2026-07-28 立:从 (marketing)/page.tsx 抽出,工作区版 (/home) 共用同一份内容,
 * 保证两处完全一致(分页结构 + 7 个 section 渲染 + aria-label 文案 + footer 控制)。
 *
 * - 路由层 (marketing)/page.tsx 与 (main)/home/page.tsx 各自负责外壳:
 *   scroll 容器 + useFullPageScroll + PageIndicator + ScrollDownButton
 * - 本组件只负责 7 个 section 的纯渲染,不引入任何滚动 hook
 * - showFooter 默认 true(营销页需要 footer);(main)/home 传 false 隐藏(工作区不需要)
 */
export const TOTAL_PAGES = 7

interface HomeSectionsProps {
  /** 是否渲染 SiteFooter,默认 true(营销页需要,工作区首页不需要) */
  showFooter?: boolean
}

const BENEFITS_KEYS = [
  'benefit1',
  'benefit2',
  'benefit3',
  'benefit4',
  'benefit5',
  'benefit6',
] as const

export function HomeSections({ showFooter = true }: HomeSectionsProps) {
  const t = useTranslations('marketing')
  const te = useTranslations('enterprise')
  const tr = useTranslations('marketing.roi')
  const tc = useTranslations('marketing.comparison')

  const benefits = BENEFITS_KEYS.map((k) => t(`welcome.benefits.${k}`))

  return (
    <>
      {/* Page 1: Hero typewriter + 4 信任徽章 + 6 Benefits + 通知跑马灯 */}
      <section
        id="home-page-1"
        className="relative flex snap-start flex-col overflow-hidden"
        style={{ minHeight: 'calc(100vh - 1rem)' }}
        aria-label={t('indicator.page1', { fallback: 'Hero' })}
      >
        {/* 顶部固定区:Marquee 通知跑马灯 + GithubStarBanner */}
        <div className="relative z-10 flex w-full flex-col gap-2 px-4 pt-4 md:px-8 md:pt-6">
          <Marquee />
          <GithubStarBanner />
        </div>

        {/* 主区:hero + 信任行,flex-1 占满所有剩余空间 */}
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center gap-4 md:gap-5">
          <TypewriterHeroSection />

          {/* 4 个信任徽章 */}
          <RevealOnView
            delay={0.4}
            as="div"
            className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 text-[11px] text-muted-foreground md:text-xs"
          >
            <span className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary transition-transform duration-200 group-hover:scale-110" />
              {t('welcome.benefits.benefit6')}
            </span>
            <span className="hidden h-3 w-px bg-border md:inline-block" />
            <span className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5">
              <Users className="h-3.5 w-3.5 text-primary transition-transform duration-200 group-hover:scale-110" />
              {t('welcome.seats')}
            </span>
            <span className="hidden h-3 w-px bg-border md:inline-block" />
            <span className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5">
              <Zap className="h-3.5 w-3.5 text-primary transition-transform duration-200 group-hover:scale-110" />
              {t('welcome.earlyBird')}
            </span>
            <span className="hidden h-3 w-px bg-border md:inline-block" />
            <span className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5">
              <Globe className="h-3.5 w-3.5 text-primary transition-transform duration-200 group-hover:scale-110" />
              {t('welcome.multiEnd')}
            </span>
          </RevealOnView>
        </div>

        {/* 底部固定区:6 Benefits */}
        <div className="relative z-10 flex w-full flex-col gap-2 px-4 pb-12 md:px-8 md:pb-14">
          <ul className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3 lg:grid-cols-6">
            {benefits.map((b, i) => (
              <RevealOnView
                key={i}
                as="li"
                delay={0.5 + i * 0.06}
                className="group relative flex items-center gap-2 overflow-hidden rounded-lg border bg-card px-3 py-2 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md md:text-sm"
              >
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-success transition-transform duration-200 group-hover:scale-110"
                  aria-hidden="true"
                />
                <span className="truncate">{b}</span>
              </RevealOnView>
            ))}
          </ul>
        </div>
      </section>

      {/* Page 2: 5 Features + 4 Advantages */}
      <section
        id="home-page-2"
        className="relative flex snap-start flex-col overflow-hidden"
        style={{ minHeight: 'calc(100vh - 1rem)' }}
        aria-label={t('features.title', { fallback: 'Features' })}
      >
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-4 md:px-8 md:py-6">
          <div className="w-full">
            <HomeFeatureGrid />
          </div>
        </div>
      </section>

      {/* Page 3: 5 Scenarios */}
      <section
        id="home-page-3"
        className="relative flex snap-start flex-col overflow-hidden"
        style={{ minHeight: 'calc(100vh - 1rem)' }}
        aria-label={t('scenarios.title', { fallback: 'Scenarios' })}
      >
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-4 md:px-8 md:py-6">
          <div className="w-full">
            <HomeScenarios />
          </div>
        </div>
      </section>

      {/* Page 4: 8 ROI */}
      <section
        id="home-page-4"
        className="relative flex snap-start flex-col overflow-hidden"
        style={{ minHeight: 'calc(100vh - 1rem)' }}
        aria-label={tr('title', { fallback: 'ROI' })}
      >
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-4 md:px-8 md:py-6">
          <div className="w-full">
            <HomeRoi />
          </div>
        </div>
      </section>

      {/* Page 5: 8 行竞品对比表 */}
      <section
        id="home-page-5"
        className="relative flex snap-start flex-col overflow-hidden"
        style={{ minHeight: 'calc(100vh - 1rem)' }}
        aria-label={tc('title', { fallback: 'Comparison' })}
      >
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-4 md:px-8 md:py-6">
          <div className="w-full">
            <HomeComparison />
          </div>
        </div>
      </section>

      {/* Page 6: 4 定价卡 + 4 Stat 数据条 + 品牌跑马灯 */}
      <section
        id="home-page-6"
        className="relative flex flex-col snap-start overflow-hidden"
        style={{ minHeight: 'calc(100vh - 1rem)' }}
        aria-label={t('pricing.title', { fallback: 'Pricing' })}
      >
        <div className="relative z-10 flex h-full w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
          {/* Pricing 4 卡 */}
          <div className="w-full">
            <HomePage4Pricing />
          </div>

          {/* 4 Stat 数据条 */}
          <div className="mx-auto w-full max-w-5xl px-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
              {[
                { value: 8, suffix: '', label: t('stats.platforms') },
                { value: 100, suffix: '+', label: t('stats.models') },
                { value: 6000, prefix: '¥', label: te('hero.priceEarlyBird') },
                { value: 18, suffix: '', label: t('stats.seats') },
              ].map((s, i) => (
                <RevealOnView
                  key={i}
                  delay={0.2 + 0.08 * i}
                  className="group relative flex flex-col items-center gap-0.5 overflow-hidden rounded-lg border bg-card/80 px-3 py-2 text-center backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 md:py-3"
                >
                  <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-xl font-bold tracking-tight text-transparent transition-transform duration-300 group-hover:scale-110 md:text-2xl">
                    {s.prefix && <span>{s.prefix}</span>}
                    <AnimatedNumber value={s.value} duration={1500} />
                    {s.suffix && <span>{s.suffix}</span>}
                  </span>
                  <span className="line-clamp-2 text-[10px] text-muted-foreground md:text-xs">
                    {s.label}
                  </span>
                </RevealOnView>
              ))}
            </div>
          </div>

          {/* Brand 跑马灯 */}
          <RevealOnView as="div" delay={0.3} className="w-full max-w-7xl px-4">
            <BrandMarquee />
          </RevealOnView>
        </div>
      </section>

      {/* Page 7: Magazine 新闻 + (可选) Footer */}
      <section
        id="home-page-7"
        className="flex min-h-[calc(100vh-1rem)] snap-start flex-col"
        aria-label={t('magazine.title', { fallback: 'News' })}
      >
        <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-2 md:px-8 md:pt-5 md:pb-2">
          <HomePage3Magazine />
        </div>
        {showFooter && <SiteFooter className="mt-0" />}
      </section>
    </>
  )
}
