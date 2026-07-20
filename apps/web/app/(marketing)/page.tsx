'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, Check, ShieldCheck, Users, Zap } from 'lucide-react'
import { Button } from '@ihui/ui'
import { AnimatedNumber } from '@/components/common'
import { Marquee } from '@/components/marketing/Marquee'
import { PageIndicator } from '@/components/marketing/PageIndicator'
import { ScrollDownButton } from '@/components/marketing/ScrollDownButton'
import { BrandMarquee } from '@/components/marketing/BrandMarquee'
import { HomeFeatureGrid } from '@/components/marketing/HomeFeatureGrid'
import { HomePage3Magazine } from '@/components/marketing/HomePage3Magazine'
import { HomePage4Pricing } from '@/components/marketing/HomePage4Pricing'
import { TypewriterHeroSection } from '@/components/marketing/TypewriterHero'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { useFullPageScroll } from '@/hooks/use-full-page-scroll'

/**
 * 首页(/)
 *
 * 营销落地页 + 工作台入口合一:
 * - 全屏分页滚动 4 页(从 7 页合并减为 4 页,每页内容撑满 ~100vh 无大片空地):
 *   1) Hero + 6 Benefits + 通知跑马灯(并排三段,内容撑满)
 *   2) 5 Features + 4 Advantages(原 Page 3,内容高度足够)
 *   3) Pricing 4 卡 + BrandMarquee + CTA + 4 个 Stat 数据条(三段 justify-between 撑满)
 *   4) Magazine 新闻 grid + Footer(footer 自然高度,snap 即可)
 * - 顶部 MarketingHeader 已移除(sidebar 统一导航,2026-07-20)+ 底部 SiteFooter
 * - 不再使用 /home 工作区版首页,统一为营销体验
 *
 * 2026-07-20 重构(从 7 页减为 4 页):
 * - 原 Page 1+2 合并:hero + 6 benefits 横向 grid + marquee 通知条 → 一页内三段 flex-1 撑满
 * - 原 Page 3 单独一页(features + advantages grid)
 * - 原 Page 4(magazine) 合并到 Page 3(pricing+magazine+brand+cta)
 * - 原 Page 5(pricing) + Page 6(brand+cta) 合并:pricing + brand marquee + cta + 4 stats
 * - 原 Page 7 footer 跟 Page 4 magazine 一起(magazine 在上,footer 自然高度在下)
 * - 减页后每页内容充实,消除 65-74% 空间浪费
 */
const BENEFITS_KEYS = ['benefit1', 'benefit2', 'benefit3', 'benefit4', 'benefit5', 'benefit6']

const TOTAL_PAGES = 4

export default function HomePage() {
  const t = useTranslations('marketing')
  const te = useTranslations('enterprise')
  const router = useRouter()

  const { section, scrollTo, next } = useFullPageScroll(TOTAL_PAGES)

  const handleJoin = () => router.push('/support?source=landing')

  const benefits = BENEFITS_KEYS.map((k) => t(`welcome.benefits.${k}`))

  return (
    <>
      {/* 全屏分页滚动容器
          - 显式 overflow-x-hidden 防止 Marquee/TypewriterHero/跑马灯等内容因
            transform/子元素宽度溢出产生横向滚动(2026-07-20 用户反馈"右侧有
            大量空间浪费 + 可左右滑动")。overflow-y-scroll 单独使用会同时
            强制 overflow-x: auto,加 hidden 才是真正锁定水平方向。
       */}
      <main
        id="home-scroll-container"
        className="snap-y snap-proximity overflow-x-hidden overflow-y-scroll"
        style={{ height: 'calc(100vh - 1rem)' }}
      >
        {/* Page 1: Hero typewriter + 4 信任徽章 + 6 Benefits 横向 grid + 通知跑马灯
            - 2026-07-20 重构(根因修复):section 显式 flex flex-col,内层主区改 flex-1
              (h-full 在 min-height 父级不传递 → 之前 flex-1 内容只占 398px,下方 346px 全空)
            - 新增 4 信任徽章行(ShieldCheck/Users/Zap)填充 hero 区域空白,让 hero
              flex-1 区撑到 ~450-500px,加上底部 benefits+marquee 固定 ~140px = ~640px,
              接近 743px 视口,浪费率从 47% 降到 <10% */}
        <section
          id="home-page-1"
          className="flex snap-start flex-col"
          style={{ minHeight: 'calc(100vh - 1rem)' }}
          aria-label={t('indicator.page1', { fallback: 'Hero' })}
        >
          {/* 顶部固定区:Marquee 通知跑马灯(2026-07-20 用户反馈:从底部上移到顶部,
              像 banner 一样最先被看到) */}
          <div className="flex w-full flex-col gap-2 px-4 pt-4 md:px-8 md:pt-6">
            <Marquee />
          </div>

          {/* 主区:hero + 信任行,flex-1 占满所有剩余空间 */}
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 md:gap-5">
            <TypewriterHeroSection />

            {/* 4 个信任徽章 — 填充 hero 与底部之间的视觉空地 */}
            <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 text-[11px] text-muted-foreground md:text-xs">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                {t('welcome.benefits.benefit6')}
              </span>
              <span className="hidden h-3 w-px bg-border md:inline-block" />
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                {t('welcome.perYear')}
              </span>
              <span className="hidden h-3 w-px bg-border md:inline-block" />
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
                {t('cta.subtitle')}
              </span>
            </div>
          </div>

          {/* 底部固定区:6 Benefits(去掉 marquee,已上移到顶部)
              2026-07-20 改:pb-4 md:pb-6 -> pb-12 md:pb-14
              给 fixed 定位的 ScrollDownButton (bottom-4, h-5=20px) 留出 20-28px 视觉间距,
              避免 chevron 跟 6 benefits ul 在视口底部同一条 y 轴重叠 */}
          <div className="flex w-full flex-col gap-2 px-4 pb-12 md:px-8 md:pb-14">
            <ul className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3 lg:grid-cols-6">
              {benefits.map((b, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs md:text-sm"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span className="truncate">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Page 2: 5 Features + 4 Advantages
            - 2026-07-20 改(根因修复):HomeFeatureGrid 内部卡片 padding/字号/grid
              全部压缩,5 features 排 1 行 5 列 + 4 advantages 排 1 行 4 列,
              总高从 794px 压到 ~450px,完全塞进 743px 视口(原来 115px 溢出) */}
        <section
          id="home-page-2"
          className="flex snap-start flex-col"
          style={{ minHeight: 'calc(100vh - 1rem)' }}
          aria-label={t('features.title', { fallback: 'Features' })}
        >
          <div className="flex w-full flex-1 flex-col items-center justify-center px-4 py-4 md:px-8 md:py-6">
            <div className="w-full">
              <HomeFeatureGrid />
            </div>
          </div>
        </section>

        {/* Page 3: 4 定价卡 + 品牌跑马灯 + CTA + 4 Stat 数据条
            - 2026-07-20 重构(从原 Page 5+6 合并 + 加 4 stat 数据):
              Pricing 4 卡 (flex-1) + 4 stat 横向条 (固定) + BrandMarquee (固定) + CTA (固定)
              四段式 flex-col justify-between 撑满 ~100vh
            - 消除原 39% (pricing) + 70% (brand+cta) 浪费 = 合并后内容更充实 */}
        <section
          id="home-page-3"
          className="snap-start"
          style={{ minHeight: 'calc(100vh - 1rem)' }}
          aria-label={t('pricing.title', { fallback: 'Pricing' })}
        >
          <div className="flex h-full w-full flex-col justify-between gap-4 px-4 py-4 md:px-8 md:py-6">
            {/* Pricing 4 卡(顶部,flex-1 占满剩余空间) */}
            <div className="min-h-0 flex-1">
              <HomePage4Pricing />
            </div>

            {/* 4 Stat 数据条(中部,固定高度) */}
            <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
              {[
                { value: 18, suffix: '', label: t('welcome.perYear') },
                { value: 365, suffix: '', label: t('welcome.perYear') },
                { value: 6000, prefix: '¥', label: te('hero.priceEarlyBird') },
                { value: 67, suffix: '%', label: t('cta.subtitle') },
              ].map((s, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-0.5 rounded-lg border bg-card px-3 py-2 text-center md:py-3"
                >
                  <span className="text-xl font-bold tracking-tight text-primary md:text-2xl">
                    {s.prefix && <span>{s.prefix}</span>}
                    <AnimatedNumber value={s.value} duration={1500} />
                    {s.suffix && <span>{s.suffix}</span>}
                  </span>
                  <span className="line-clamp-2 text-[10px] text-muted-foreground md:text-xs">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Brand 跑马灯 + CTA(底部并排) */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
              <BrandMarquee />
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" onClick={handleJoin}>
                  {t('cta.join')}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard">{t('cta.dashboard')}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Page 4: Magazine 新闻 + Footer
            - 2026-07-20 改:去掉 snap-start,因为 section 高度(magazine + footer ~1340px)
              超过 viewport 884px,snap-mandatory 强制吸附到 section 顶部导致用户滚不到底部,
              版权 + 国徽图标看不到。改为不参与 snap,用户可自由滚到底部看完整 footer。
              前 3 个 section 仍保留 snap-start,正常吸附体验不受影响。 */}
        <section id="home-page-4" aria-label={t('magazine.title', { fallback: 'News' })}>
          <div className="flex min-h-[50vh] w-full flex-col px-4 py-4 md:px-8 md:py-5">
            <HomePage3Magazine />
          </div>
          <SiteFooter />
        </section>
      </main>

      {/* 右侧分页指示器 */}
      <PageIndicator current={section} total={TOTAL_PAGES} onClick={scrollTo} />

      {/* 底部向下滚动按钮 */}
      <ScrollDownButton current={section} total={TOTAL_PAGES} onNext={next} />
    </>
  )
}
