'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, Globe, ShieldCheck, Users, Zap } from 'lucide-react'
import { AnimatedNumber } from '@/components/common'
import { Marquee } from '@/components/marketing/Marquee'
import { PageIndicator } from '@/components/marketing/PageIndicator'
import { ScrollDownButton } from '@/components/marketing/ScrollDownButton'
import { BrandMarquee } from '@/components/marketing/BrandMarquee'
import { HomeFeatureGrid } from '@/components/marketing/HomeFeatureGrid'
import { HomeScenarioGrid } from '@/components/marketing/HomeScenarioGrid'
import { HomePage3Magazine } from '@/components/marketing/HomePage3Magazine'
import { HomePage4Pricing } from '@/components/marketing/HomePage4Pricing'
import { TypewriterHeroSection } from '@/components/marketing/TypewriterHero'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { useFullPageScroll } from '@/hooks/use-full-page-scroll'

/**
 * 首页(/)
 *
 * 营销落地页 + 工作台入口合一:
 * - 全屏分页滚动 5 页(2026-07-20 升级:新增 Page 3 决策者场景 + ROI + 竞品对比):
 *   1) Hero + 6 Benefits + 通知跑马灯
 *   2) 5 Features + 4 Advantages(原 Page 2)
 *   3) 5 Scenarios + 8 ROI + 8 行竞品对比表(2026-07-20 新增,解决用户"功能不全/优势不明"反馈)
 *   4) Pricing 4 卡 + BrandMarquee + 4 Stats(原 Page 3)
 *   5) Magazine 新闻 grid + Footer(原 Page 4)
 *
 * 2026-07-20 升级(从 4 页扩为 5 页,深度营销):
 * - 新增 Page 3:5 大决策者场景 + 8 项可量化 ROI + 8 行 vs Claude Code/Cursor/ChatGPT 对比
 * - 让决策者一眼看到场景化价值主张 + 量化收益 + 竞品全维度超越
 * - 解决用户反馈"功能不全 不细致 优势没说明白 没有让人想使用的冲动"
 */
const BENEFITS_KEYS = ['benefit1', 'benefit2', 'benefit3', 'benefit4', 'benefit5', 'benefit6']

const TOTAL_PAGES = 5

export default function HomePage() {
  const t = useTranslations('marketing')
  const te = useTranslations('enterprise')

  const { section, scrollTo, next } = useFullPageScroll(TOTAL_PAGES)

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

            {/* 4 个信任徽章 — 填充 hero 与底部之间的视觉空地
                2026-07-20 重构:从 3 个改为 4 个,修复 cta.subtitle 长句错位
                1. 不满意全额退款(benefit6)
                2. 限 18 席决策者(welcome.seats)
                3. 早鸟价 ¥6000/年(welcome.earlyBird)
                4. 8 端全覆盖(welcome.multiEnd) */}
            <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 text-[11px] text-muted-foreground md:text-xs">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                {t('welcome.benefits.benefit6')}
              </span>
              <span className="hidden h-3 w-px bg-border md:inline-block" />
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                {t('welcome.seats')}
              </span>
              <span className="hidden h-3 w-px bg-border md:inline-block" />
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
                {t('welcome.earlyBird')}
              </span>
              <span className="hidden h-3 w-px bg-border md:inline-block" />
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-primary" />
                {t('welcome.multiEnd')}
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

        {/* Page 3: 5 Scenarios + 8 ROI + 8 行竞品对比表(2026-07-20 新增)
            - 解决用户反馈"功能不全 不细致 优势没说明白 没有让人想使用的冲动"
            - 让决策者一眼看到场景化价值主张 + 量化收益 + 竞品全维度超越
            - 三段式紧凑布局:5 场景(5 列)+ 8 ROI(4 列 x 2 行)+ 对比表(8 行 5 列) */}
        <section
          id="home-page-3"
          className="flex snap-start flex-col"
          style={{ minHeight: 'calc(100vh - 1rem)' }}
          aria-label={t('scenarios.title', { fallback: 'Scenarios' })}
        >
          <div className="flex w-full flex-1 flex-col items-center justify-center px-4 py-4 md:px-8 md:py-6">
            <div className="w-full">
              <HomeScenarioGrid />
            </div>
          </div>
        </section>

        {/* Page 4: 4 定价卡 + 品牌跑马灯 + CTA + 4 Stat 数据条
            - 2026-07-20 重构(从原 Page 5+6 合并 + 加 4 stat 数据):
              Pricing 4 卡 (flex-1) + 4 stat 横向条 (固定) + BrandMarquee (固定) + CTA (固定)
              四段式 flex-col justify-between 撑满 ~100vh
            - 消除原 39% (pricing) + 70% (brand+cta) 浪费 = 合并后内容更充实 */}
        <section
          id="home-page-4"
          className="snap-start"
          style={{ minHeight: 'calc(100vh - 1rem)' }}
          aria-label={t('pricing.title', { fallback: 'Pricing' })}
        >
          <div className="flex h-full w-full flex-col justify-between gap-4 px-4 py-4 md:px-8 md:py-6">
            {/* Pricing 4 卡(顶部,flex-1 占满剩余空间) */}
            <div className="min-h-0 flex-1">
              <HomePage4Pricing />
            </div>

            {/* 4 Stat 数据条(中部,固定高度)
                2026-07-20 重构:从 [18, 365, 6000, 67%] 改为 [8, 100+, ¥6000, 18]
                1. 8 端全覆盖(stats.platforms)
                2. 100+ 大模型接入(stats.models)
                3. ¥6000 元/人/年 早鸟价(enterprise.hero.priceEarlyBird)
                4. 18 席限位 · 决策者(stats.seats)
                修复原 67% + cta.subtitle 长句错位 bug */}
            <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
              {[
                { value: 8, suffix: '', label: t('stats.platforms') },
                { value: 100, suffix: '+', label: t('stats.models') },
                { value: 6000, prefix: '¥', label: te('hero.priceEarlyBird') },
                { value: 18, suffix: '', label: t('stats.seats') },
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

            {/* Brand 跑马灯(底部,删除原 CTA 按钮组 2026-07-20:
                用户要求"不需要有这个跳转功能",移除"立即加入"/"进入工作台"按钮,
                仅保留品牌跑马灯展示) */}
            <BrandMarquee />
          </div>
        </section>

        {/* Page 5: Magazine 新闻 + Footer
            - 2026-07-20 改(自适应 v3):section min-h 视口高度,flex flex-col,snap-start。
            - magazine 加回 flex-1 min-h-0:让 magazine 撑开 = 视口 - footer 自然高度。
            - HomePage3Magazine 内部已改 flex-1 flex-col(2026-07-20),让 Card / grid
              撑开 magazine 容器,根 section flex-1 + "查看更多" mt-auto 推到底。
              彻底消除"暂无内容"卡片下方 200+px 大空隙。
            - footer 高度完全由内容决定 (~180-200px),不再被 section flex 强制拉伸。 */}
        <section
          id="home-page-5"
          className="flex min-h-[calc(100vh-1rem)] snap-start flex-col"
          aria-label={t('magazine.title', { fallback: 'News' })}
        >
          <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-2 md:px-8 md:pt-5 md:pb-2">
            <HomePage3Magazine />
          </div>
          {/* mt-0 替代 mt-auto:magazine 已 flex-1 撑开,footer 紧贴下方无缝衔接。
              mt-auto 会留中间大空白,已实测验证。 */}
          <SiteFooter className="mt-0" />
        </section>
      </main>

      {/* 右侧分页指示器 */}
      <PageIndicator current={section} total={TOTAL_PAGES} onClick={scrollTo} />

      {/* 底部向下滚动按钮 */}
      <ScrollDownButton current={section} total={TOTAL_PAGES} onNext={next} />
    </>
  )
}
