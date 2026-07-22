'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, Globe, ShieldCheck, Users, Zap } from 'lucide-react'
import { AnimatedNumber, RevealOnView } from '@/components/common'
import { Marquee } from '@/components/marketing/Marquee'
import { PageIndicator } from '@/components/marketing/PageIndicator'
import { ScrollDownButton } from '@/components/marketing/ScrollDownButton'
import { BrandMarquee } from '@/components/marketing/BrandMarquee'
import { HomeFeatureGrid } from '@/components/marketing/HomeFeatureGrid'
import { HomeScenarios } from '@/components/marketing/HomeScenarios'
import { HomeRoi } from '@/components/marketing/HomeRoi'
import { HomeComparison } from '@/components/marketing/HomeComparison'
import { HomePage3Magazine } from '@/components/marketing/HomePage3Magazine'
import { HomePage4Pricing } from '@/components/marketing/HomePage4Pricing'
import { TypewriterHeroSection } from '@/components/marketing/TypewriterHero'
import { HomeDecor } from '@/components/marketing/HomeDecor'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { useFullPageScroll } from '@/hooks/use-full-page-scroll'

/**
 * 首页(/)
 *
 * 营销落地页 + 工作台入口合一:
 * - 全屏分页滚动 7 页(2026-07-21 升级:Page 3 拆 3 页,解决"内容太拥挤"反馈):
 *   1) Hero + 6 Benefits + 通知跑马灯
 *   2) 5 Features + 4 Advantages(原 Page 2)
 *   3) 5 Scenarios(2026-07-21 从原 Page 3 拆出)
 *   4) 8 ROI(2026-07-21 从原 Page 3 拆出)
 *   5) 8 行竞品对比表(2026-07-21 从原 Page 3 拆出)
 *   6) Pricing 4 卡 + BrandMarquee + 4 Stats(原 Page 4)
 *   7) Magazine 新闻 grid + Footer(原 Page 5)
 *
 * 2026-07-21 升级(从 5 页扩为 7 页,降低单页密度):
 * - 拆分原 Page 3(5 Scenarios + 8 ROI + 8 行对比表)为 3 个独立 snap section
 * - 解决用户反馈"内容太拥挤了,再分个页面出来,为什么要这么做"
 * - 每页信息密度降低 30-40%,字号 / 间距 / 行高全部放大一档,移动端阅读更舒服
 */
const BENEFITS_KEYS = ['benefit1', 'benefit2', 'benefit3', 'benefit4', 'benefit5', 'benefit6']

const TOTAL_PAGES = 7

export default function HomePage() {
  const t = useTranslations('marketing')
  const te = useTranslations('enterprise')
  // 2026-07-21 新增:tr / tc 用于 Page 4 (ROI) / Page 5 (Comparison) 的 aria-label
  const tr = useTranslations('marketing.roi')
  const tc = useTranslations('marketing.comparison')

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
          className="relative flex snap-start flex-col overflow-hidden"
          style={{ minHeight: 'calc(100vh - 1rem)' }}
          aria-label={t('indicator.page1', { fallback: 'Hero' })}
        >
          {/* Hero 区装饰光斑 — absolute,在内容下方,打破"纯文字卡片"单调感 */}
          <HomeDecor />

          {/* 顶部固定区:Marquee 通知跑马灯(2026-07-20 用户反馈:从底部上移到顶部,
              像 banner 一样最先被看到) */}
          <div className="relative z-10 flex w-full flex-col gap-2 px-4 pt-4 md:px-8 md:pt-6">
            <Marquee />
          </div>

          {/* 主区:hero + 信任行,flex-1 占满所有剩余空间 */}
          <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center gap-4 md:gap-5">
            <TypewriterHeroSection />

            {/* 4 个信任徽章 — 填充 hero 与底部之间的视觉空地
                2026-07-20 重构:从 3 个改为 4 个,修复 cta.subtitle 长句错位
                1. 不满意全额退款(benefit6)
                2. 限 18 席决策者(welcome.seats)
                3. 早鸟价 ¥6000/年(welcome.earlyBird)
                4. 8 端全覆盖(welcome.multiEnd)
                2026-07-23 改:加 hover 上浮微交互 + 入场动画 */}
            <RevealOnView
              delay={0.4}
              as="div"
              className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 text-[11px] text-muted-foreground md:text-xs"
            >
              <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                {t('welcome.benefits.benefit6')}
              </span>
              <span className="hidden h-3 w-px bg-border md:inline-block" />
              <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5">
                <Users className="h-3.5 w-3.5 text-primary" />
                {t('welcome.seats')}
              </span>
              <span className="hidden h-3 w-px bg-border md:inline-block" />
              <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5">
                <Zap className="h-3.5 w-3.5 text-primary" />
                {t('welcome.earlyBird')}
              </span>
              <span className="hidden h-3 w-px bg-border md:inline-block" />
              <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5">
                <Globe className="h-3.5 w-3.5 text-primary" />
                {t('welcome.multiEnd')}
              </span>
            </RevealOnView>
          </div>

          {/* 底部固定区:6 Benefits(去掉 marquee,已上移到顶部)
              2026-07-20 改:pb-4 md:pb-6 -> pb-12 md:pb-14
              给 fixed 定位的 ScrollDownButton (bottom-4, h-5=20px) 留出 20-28px 视觉间距,
              避免 chevron 跟 6 benefits ul 在视口底部同一条 y 轴重叠
              2026-07-23 改:每张卡片入场 staggered + hover 上浮 */}
          <div className="relative z-10 flex w-full flex-col gap-2 px-4 pb-12 md:px-8 md:pb-14">
            <ul className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3 lg:grid-cols-6">
              {benefits.map((b, i) => (
                <RevealOnView
                  key={i}
                  as="li"
                  delay={0.5 + i * 0.06}
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm md:text-sm"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span className="truncate">{b}</span>
                </RevealOnView>
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

        {/* Page 3: 5 Scenarios(2026-07-21 从原 Page 3 拆出,降密度)
            - 解决用户反馈"内容太拥挤了 再分个页面出来"
            - 单页只装 5 张场景卡,字号 / padding / 描述行数全部放大一档
            - 痛点 → 解决 → 收益 三段式,每段都更醒目可读 */}
        <section
          id="home-page-3"
          className="flex snap-start flex-col"
          style={{ minHeight: 'calc(100vh - 1rem)' }}
          aria-label={t('scenarios.title', { fallback: 'Scenarios' })}
        >
          <div className="flex w-full flex-1 flex-col items-center justify-center px-4 py-4 md:px-8 md:py-6">
            <div className="w-full">
              <HomeScenarios />
            </div>
          </div>
        </section>

        {/* Page 4: 8 ROI(2026-07-21 从原 Page 3 拆出,降密度)
            - 8 张可量化 ROI 卡片独立成页,公式行 / 描述行都可读
            - 让决策者专注"省多少钱 / 提多少效" */}
        <section
          id="home-page-4"
          className="flex snap-start flex-col"
          style={{ minHeight: 'calc(100vh - 1rem)' }}
          aria-label={tr('title', { fallback: 'ROI' })}
        >
          <div className="flex w-full flex-1 flex-col items-center justify-center px-4 py-4 md:px-8 md:py-6">
            <div className="w-full">
              <HomeRoi />
            </div>
          </div>
        </section>

        {/* Page 5: 8 行竞品对比表(2026-07-21 从原 Page 3 拆出,降密度)
            - 8 行 vs Claude Code/Cursor/ChatGPT 对比独立成页
            - 表头 / 单元格 padding 全部加大,行高更舒服 */}
        <section
          id="home-page-5"
          className="flex snap-start flex-col"
          style={{ minHeight: 'calc(100vh - 1rem)' }}
          aria-label={tc('title', { fallback: 'Comparison' })}
        >
          <div className="flex w-full flex-1 flex-col items-center justify-center px-4 py-4 md:px-8 md:py-6">
            <div className="w-full">
              <HomeComparison />
            </div>
          </div>
        </section>

        {/* Page 6: 4 定价卡 + 4 Stat 数据条 + 品牌跑马灯
            - 2026-07-21 v4 改(根因修复"偏上"):用户反馈"图片里这个页面里的内容排版布局不合理 太偏上了"。
              v3 修了 `flex h-full items-center justify-center`,但 section 没有 flex 容器
              → h-full 在 block 容器里失效,innerDiv 高度只占内容自然高 729.5px,
                justify-center 在 729.5px 内部居中,顶部仍紧贴 section 顶端 (0px gap),
                下方留 482.5px 大空白
              v4:section 改 `flex flex-col` + innerDiv 改 `flex-1` 真正占满 section 全高 (1212px),
                justify-center 真正在 1212px 内居中,上下均分空白 (约 240px each)
            - v3.1:marquee 容器去掉自带的 px-3 + 整体加 max-w-7xl 限宽防溢出 */}
        <section
          id="home-page-6"
          className="flex flex-col snap-start"
          style={{ minHeight: 'calc(100vh - 1rem)' }}
          aria-label={t('pricing.title', { fallback: 'Pricing' })}
        >
          <div className="flex h-full w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
            {/* Pricing 4 卡(顶部,自然高度,不再 flex-1 撑大) */}
            <div className="w-full">
              <HomePage4Pricing />
            </div>

            {/* 4 Stat 数据条(中部,固定高度)
                2026-07-20 重构:从 [18, 365, 6000, 67%] 改为 [8, 100+, ¥6000, 18]
                1. 8 端全覆盖(stats.platforms)
                2. 100+ 大模型接入(stats.models)
                3. ¥6000 元/人/年 早鸟价(enterprise.hero.priceEarlyBird)
                4. 18 席限位 · 决策者(stats.seats)
                修复原 67% + cta.subtitle 长句错位 bug
                v3:加 max-w-5xl 限宽,居中对称
                2026-07-23 改:每个 Stat 入场 staggered + hover 上浮 + 图标背景 */}
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
                    className="group flex flex-col items-center gap-0.5 rounded-lg border bg-card px-3 py-2 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md md:py-3"
                  >
                    <span className="text-xl font-bold tracking-tight text-primary transition-transform duration-300 group-hover:scale-110 md:text-2xl">
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

            {/* Brand 跑马灯(底部,固定高度,删除原 CTA 按钮组 2026-07-20:
                用户要求"不需要有这个跳转功能",移除"立即加入"/"进入工作台"按钮,
                仅保留品牌跑马灯展示
                v3:加 max-w-7xl 限宽 + px-4 对称 padding
                2026-07-23 改:加入场动画 */}
            <RevealOnView as="div" delay={0.3} className="w-full max-w-7xl px-4">
              <BrandMarquee />
            </RevealOnView>
          </div>
        </section>

        {/* Page 7: Magazine 新闻 + Footer
            - 2026-07-20 改(自适应 v3):section min-h 视口高度,flex flex-col,snap-start。
            - magazine 加回 flex-1 min-h-0:让 magazine 撑开 = 视口 - footer 自然高度。
            - HomePage3Magazine 内部已改 flex-1 flex-col(2026-07-20),让 Card / grid
              撑开 magazine 容器,根 section flex-1 + "查看更多" mt-auto 推到底。
              彻底消除"暂无内容"卡片下方 200+px 大空隙。
            - footer 高度完全由内容决定 (~180-200px),不再被 section flex 强制拉伸。 */}
        <section
          id="home-page-7"
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
