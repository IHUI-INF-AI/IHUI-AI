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

/** 7-section 公共 wrapper — 收敛 id/snap-start/minHeight/aria-label 4 项重复
 *
 * 抽离理由(2026-07-28 v2):7 个 section 顶层结构几乎相同
 *   `<section id="home-page-N" className="relative flex snap-start flex-col overflow-hidden"
 *   style={{ minHeight: 'calc(100vh - 1rem)' }} aria-label={...}>`
 * 每个 section 重复 3-4 行,7 处共 21-28 行冗余;抽 Frame 后净省 ~16 行且语义清晰。
 *
 * 2026-07-30 用户反馈"问题太大"二次根治:把默认 height 改回 'calc(100vh - 1rem)'。
 * 上一轮改 'auto' 导致 section 自然高 472-891px,小于 main 视口 1177px,
 * 滚到 Page 1 时下面 700px 是 Page 2+Page 3 顶部内容"提前溢出",
 * 滚到 Page 2 同样看到 Page 3+Page 4 溢出,snap-y 滚动混乱。
 * 改回 'calc(100vh - 1rem)' 后:每个 section 撑满 1177px = main 视口高,
 * snap-y 严格按 section 跳,每页只显示该页内容(无溢出)。
 * 内容紧凑性由 Page 1 主区改用 justify-center 让 Hero+4徽章+6Benefits 整组居中保证。 */
function HomeSectionFrame({
  page,
  ariaLabel,
  height = 'calc(100vh - 58px)',
  className,
  children,
}: {
  page: number
  ariaLabel: string
  height?: string
  /** 自定义 className 覆盖默认(用模板字符串合并) */
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={`home-page-${page}`}
      className={`relative flex snap-start flex-col overflow-hidden${className ? ` ${className}` : ''}`}
      style={{ minHeight: height }}
      aria-label={ariaLabel}
    >
      {children}
    </section>
  )
}

export function HomeSections({ showFooter = true }: HomeSectionsProps) {
  const t = useTranslations('marketing')
  const te = useTranslations('enterprise')
  const tr = useTranslations('marketing.roi')
  const tc = useTranslations('marketing.comparison')

  const benefits = BENEFITS_KEYS.map((k) => t(`welcome.benefits.${k}`))

  return (
    <>
      {/* Page 1: Hero typewriter + 4 信任徽章 + 6 Benefits + 通知跑马灯
          2026-07-30 用户反馈"问题太大"二次根治:
          上一轮把 6 Benefits 合并到主区 + justify-evenly,但 section 改 auto 导致 snap 溢出混乱。
          本轮恢复 section 高度 = 视口(HomeSectionFrame 改回 calc(100vh - 1rem)),
          主区用 justify-center 让 Hero+4 徽章+6 Benefits 整组垂直居中,
          顶部 Marquee+Banner 固定上方,主区整组居中,不留中间夹空白。 */}
      <HomeSectionFrame page={1} ariaLabel={t('indicator.page1', { fallback: 'Hero' })}>
        {/* 顶部固定区:Marquee 通知跑马灯 + GithubStarBanner */}
        <div className="relative z-10 flex w-full flex-col gap-2 px-4 pt-4 md:px-8 md:pt-6">
          <Marquee />
          <GithubStarBanner />
        </div>

        {/* 主区:Hero + 4 徽章 + 6 Benefits(合并到主区)
            justify-center 让 3 段作为一个整体垂直居中,消除上下大片空白 */}
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center gap-4 px-4 py-2 md:gap-5 md:py-3">
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

          {/* 6 Benefits(2026-07-30 从底部 fixed 区合并到主区,justify-evenly 让它位于主区底部 1/3 位置) */}
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
      </HomeSectionFrame>

      {/* Page 2: 5 Features + 4 Advantages */}
      <HomeSectionFrame page={2} ariaLabel={t('features.title', { fallback: 'Features' })}>
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-4 md:px-8 md:py-6">
          <div className="w-full">
            <HomeFeatureGrid />
          </div>
        </div>
      </HomeSectionFrame>

      {/* Page 3: 5 Scenarios */}
      <HomeSectionFrame page={3} ariaLabel={t('scenarios.title', { fallback: 'Scenarios' })}>
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-4 md:px-8 md:py-6">
          <div className="w-full">
            <HomeScenarios />
          </div>
        </div>
      </HomeSectionFrame>

      {/* Page 4: 8 ROI */}
      <HomeSectionFrame page={4} ariaLabel={tr('title', { fallback: 'ROI' })}>
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-4 md:px-8 md:py-6">
          <div className="w-full">
            <HomeRoi />
          </div>
        </div>
      </HomeSectionFrame>

      {/* Page 5: 8 行竞品对比表 */}
      <HomeSectionFrame page={5} ariaLabel={tc('title', { fallback: 'Comparison' })}>
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-4 md:px-8 md:py-6">
          <div className="w-full">
            <HomeComparison />
          </div>
        </div>
      </HomeSectionFrame>

      {/* Page 6: 4 定价卡 + 4 Stat 数据条 + 品牌跑马灯 */}
      <HomeSectionFrame page={6} ariaLabel={t('pricing.title', { fallback: 'Pricing' })}>
        <div className="relative z-10 flex h-full w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
          {/* Pricing 4 卡 */}
          <div className="w-full">
            <HomePage4Pricing />
          </div>

          {/* 4 Stat 数据条 */}
          <div className="mx-auto w-full max-w-5xl px-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-4">
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
      </HomeSectionFrame>

      {/* Page 7: Magazine 新闻 + (可选) Footer
          注:此 section 不用 HomeSectionFrame,因结构略不同
          (用 flex snap-start flex-col,无 overflow-hidden 避免裁切 Footer 边缘);
          保留 4 行原 <section> 写法,避免 Tailwind className 源序覆盖风险。

          2026-07-30 v10 第四次调整:SiteFooter v10 拉高放宽(95→140px)后,需要给 footer 预留更多空间。
          上一版 v9 minHeight 100vh-1rem-8rem = 1097px 配 footer 95px,留 132px 余量足够。
          v10 footer 变 140px,改为 minHeight 100vh-1rem-12rem = 1029px
          (给 footer 留 140px),magazine 限在 1029-140=889px 范围内 flex-1 撑开,
          既保证 page-7 占满一屏(不破坏 snap-y),又让 3 个 QR + ICP 图标完整可见
          (main 视口 ~1229 - page-7 1029 = 200px 余量,footer 140px 完整可见)。 */}
      <section
        id="home-page-7"
        className="flex snap-start flex-col"
        style={{ minHeight: 'calc(100vh - 58px - 12rem)' }}
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
