'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, Check, Menu, Sparkles, LogIn, LayoutDashboard } from 'lucide-react'
import { Button } from '@ihui/ui'
import { AnimatedNumber } from '@/components/common'
import { Marquee } from '@/components/marketing/Marquee'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { PageIndicator } from '@/components/marketing/PageIndicator'
import { ScrollDownButton } from '@/components/marketing/ScrollDownButton'
import { BrandMarquee } from '@/components/marketing/BrandMarquee'
import { HomePage3Magazine } from '@/components/marketing/HomePage3Magazine'
import { HomePage4Pricing } from '@/components/marketing/HomePage4Pricing'
import { HomeFeatureGrid } from '@/components/marketing/HomeFeatureGrid'
import { TypewriterHeroSection } from '@/components/marketing/TypewriterHero'
import { useFullPageScroll } from '@/hooks/use-full-page-scroll'
import { useAuthStore } from '@/stores/auth'
import { useMounted } from '@/hooks/use-mounted'

const NAV_LINKS = [
  { href: '/enterprise', labelKey: 'navEnterprise' },
  { href: '/learn', labelKey: 'navCourses' },
  { href: '/agents', labelKey: 'navAgents' },
  { href: '/news', labelKey: 'navNews' },
  { href: '/ai-world', labelKey: 'navAiWorld' },
]

const BENEFITS_KEYS = ['benefit1', 'benefit2', 'benefit3', 'benefit4', 'benefit5', 'benefit6']

const TOTAL_PAGES = 6

export default function MarketingHomePage() {
  const t = useTranslations('marketing')
  const te = useTranslations('enterprise')
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  // hydration-safe: 首屏固定按"未登录"渲染,挂载后才显示真实态
  const mounted = useMounted()
  const showAuth = mounted ? isAuthenticated : false

  const { section, scrollTo, next } = useFullPageScroll(TOTAL_PAGES)

  const handleJoin = () => router.push('/support?source=landing')

  const benefits = BENEFITS_KEYS.map((k) => t(`welcome.benefits.${k}`))

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-base font-bold tracking-tight">{t('header.brand')}</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(`header.${l.labelKey}`)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {showAuth ? (
              <Button size="sm" asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-1 h-3.5 w-3.5" />
                  {t('header.dashboard')}
                </Link>
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link href="/sso/login">
                  <LogIn className="mr-1 h-3.5 w-3.5" />
                  {t('header.login')}
                </Link>
              </Button>
            )}
            <Button size="sm" variant="ghost" className="md:hidden" aria-label={t('header.menu')}>
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* 全屏分页滚动容器 */}
      <main
        id="home-scroll-container"
        className="snap-y snap-mandatory overflow-y-scroll"
        style={{ height: 'calc(100vh - 3.5rem)' }}
      >
        {/* Page 1: 打字机欢迎语 + 3 CTA + 小程序二维码弹窗 */}
        <section
          id="home-page-1"
          className="snap-start"
          style={{ minHeight: 'calc(100vh - 3.5rem)' }}
          aria-label={t('indicator.page1', { fallback: 'Hero' })}
        >
          <div className="mx-auto flex h-full w-full max-w-7xl flex-col items-center justify-center gap-3 px-4 py-4 md:px-8 md:py-6">
            <TypewriterHeroSection />
            <Marquee />
          </div>
        </section>

        {/* Page 2: 智汇 AI 社区欢迎语 + 价格 + Benefits + CTA */}
        <section
          id="home-page-2"
          className="snap-start"
          style={{ minHeight: 'calc(100vh - 3.5rem)' }}
          aria-label={t('welcome.title')}
        >
          <div className="mx-auto flex h-full w-full max-w-7xl items-center px-4 py-6 md:px-8 md:py-8">
            <section className="grid w-full gap-6 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-emerald-500/5 p-6 md:grid-cols-2 md:p-10">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {te('hero.brandLabel')}
                </div>
                <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-4xl">
                  {t('welcome.title')}
                </h1>
                <p className="text-sm text-muted-foreground md:text-base">
                  {t('welcome.subtitle')}
                </p>
                <ul className="grid gap-1.5 pt-1 sm:grid-cols-2">
                  {benefits.map((b, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col justify-center gap-3 rounded-xl border bg-card p-5 shadow-sm md:p-6">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground line-through">¥18000</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-bold tracking-tight text-primary md:text-4xl">
                      <AnimatedNumber value={6000} prefix="¥" duration={2000} />
                    </span>
                    <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      -67%
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {te('hero.priceEarlyBird')}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-base font-bold md:text-lg">
                      <AnimatedNumber value={18000} prefix="¥" duration={2000} />
                    </div>
                    <div className="text-xs text-muted-foreground">{te('hero.priceStandard')}</div>
                  </div>
                  <div>
                    <div className="text-base font-bold md:text-lg">
                      <AnimatedNumber value={18} duration={1500} />
                    </div>
                    <div className="text-xs text-muted-foreground">{te('hero.earlyBirdSlots')}</div>
                  </div>
                  <div>
                    <div className="text-base font-bold md:text-lg">
                      <AnimatedNumber value={365} duration={1500} />
                    </div>
                    <div className="text-xs text-muted-foreground">{t('welcome.perYear')}</div>
                  </div>
                </div>
                <Button size="lg" onClick={handleJoin} className="w-full">
                  {te('hero.joinNow')}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {te('join.consultHint')}
                </p>
              </div>
            </section>
          </div>
        </section>

        {/* Page 3: 5 特性 + 4 优势 */}
        <section
          id="home-page-3"
          className="snap-start"
          style={{ minHeight: 'calc(100vh - 3.5rem)' }}
          aria-label={t('features.title', { fallback: 'Features' })}
        >
          <div className="mx-auto flex h-full w-full max-w-7xl items-center px-4 py-6 md:px-8 md:py-8">
            <div className="w-full">
              <HomeFeatureGrid />
            </div>
          </div>
        </section>

        {/* Page 4: Magazine 杂志新闻 */}
        <section
          id="home-page-4"
          className="snap-start"
          style={{ minHeight: 'calc(100vh - 3.5rem)' }}
          aria-label={t('magazine.title', { fallback: 'News' })}
        >
          <div className="mx-auto flex h-full w-full max-w-7xl items-center px-4 py-6 md:px-8 md:py-8">
            <div className="w-full">
              <HomePage3Magazine />
            </div>
          </div>
        </section>

        {/* Page 5: 4 定价卡片 */}
        <section
          id="home-page-5"
          className="snap-start"
          style={{ minHeight: 'calc(100vh - 3.5rem)' }}
          aria-label={t('pricing.title', { fallback: 'Pricing' })}
        >
          <div className="mx-auto flex h-full w-full max-w-7xl items-center px-4 py-6 md:px-8 md:py-8">
            <div className="w-full">
              <HomePage4Pricing />
            </div>
          </div>
        </section>

        {/* Page 6: 15 品牌跑马灯 + CTA + Footer */}
        <section
          id="home-page-6"
          className="snap-start"
          style={{ minHeight: 'calc(100vh - 3.5rem)' }}
          aria-label={t('marquee.title', { fallback: 'Brands' })}
        >
          <div className="mx-auto flex h-full w-full max-w-7xl flex-col justify-between px-4 py-6 md:px-8 md:py-8">
            <BrandMarquee />
            {/* 底部 CTA */}
            <section className="rounded-2xl border bg-primary/5 p-6 text-center md:p-10">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t('cta.title')}</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
                {t('cta.subtitle')}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" onClick={handleJoin}>
                  {t('cta.join')}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/dashboard">{t('cta.dashboard')}</Link>
                </Button>
              </div>
            </section>
          </div>
        </section>
      </main>

      {/* 右侧分页指示器 */}
      <PageIndicator current={section} total={TOTAL_PAGES} onClick={scrollTo} />

      {/* 底部向下滚动按钮 */}
      <ScrollDownButton current={section} total={TOTAL_PAGES} onNext={next} />

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
