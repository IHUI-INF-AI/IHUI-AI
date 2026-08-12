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
import type { HomeSchema, SectionComponentType } from '@/components/marketing/home-schema'

/**
 * Server-Driven UI 渲染器(P3-4.3)。
 *
 * 把 HomeSections 的硬编码 7-section 改为 schema 驱动:
 * - 组件注册表 sectionRegistry:component type → React 组件
 * - SchemaDrivenSections 遍历 schema.sections,跳过 enabled=false,按顺序渲染
 * - section 内部布局由组件封装,schema 只控制顺序/显隐
 *
 * 零回归:默认 schema = 现有 7-section,渲染结果与原 HomeSections 完全一致。
 */

const BENEFITS_KEYS = [
  'benefit1',
  'benefit2',
  'benefit3',
  'benefit4',
  'benefit5',
  'benefit6',
] as const

/** section 公共 wrapper — 收敛 id/snap-start/minHeight/aria-label(从原 HomeSections 迁移) */
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

/** 所有 section 组件的统一 props(showFooter 仅 magazine 用,pageIndex 用于 id/ariaLabel) */
interface SectionProps {
  showFooter: boolean
  pageIndex: number
}

/** Page 1: Hero typewriter + 4 信任徽章 + 6 Benefits + 通知跑马灯 */
function HeroSection({ pageIndex }: SectionProps) {
  const t = useTranslations('marketing')
  const benefits = BENEFITS_KEYS.map((k) => t(`welcome.benefits.${k}`))
  return (
    <HomeSectionFrame page={pageIndex} ariaLabel={t('indicator.page1', { fallback: 'Hero' })}>
      <div className="relative z-10 flex w-full flex-col gap-2 px-4 pt-4 min-[768px]:px-8 min-[768px]:pt-6">
        <Marquee />
        <GithubStarBanner />
      </div>
      <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center gap-4 px-4 py-2 min-[768px]:gap-5 min-[768px]:py-3">
        <TypewriterHeroSection />
        <RevealOnView
          delay={0.4}
          as="div"
          className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 text-[11px] text-muted-foreground min-[768px]:text-xs"
        >
          <span className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary transition-transform duration-200 group-hover:scale-110" />
            {t('welcome.benefits.benefit6')}
          </span>
          <span className="hidden h-3 w-px bg-border min-[768px]:inline-block" />
          <span className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5">
            <Users className="h-3.5 w-3.5 text-primary transition-transform duration-200 group-hover:scale-110" />
            {t('welcome.seats')}
          </span>
          <span className="hidden h-3 w-px bg-border min-[768px]:inline-block" />
          <span className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5">
            <Zap className="h-3.5 w-3.5 text-primary transition-transform duration-200 group-hover:scale-110" />
            {t('welcome.earlyBird')}
          </span>
          <span className="hidden h-3 w-px bg-border min-[768px]:inline-block" />
          <span className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/5">
            <Globe className="h-3.5 w-3.5 text-primary transition-transform duration-200 group-hover:scale-110" />
            {t('welcome.multiEnd')}
          </span>
        </RevealOnView>
        <ul className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-2 min-[640px]:grid-cols-3 min-[768px]:gap-3 min-[1024px]:grid-cols-6">
          {benefits.map((b, i) => (
            <RevealOnView
              key={i}
              as="li"
              delay={0.5 + i * 0.06}
              className="group relative flex items-center gap-2 overflow-hidden rounded-lg border bg-card px-3 py-2 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md min-[768px]:text-sm"
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
  )
}

/** Page 2-5: 单组件 section 工厂(HomeFeatureGrid / HomeScenarios / HomeRoi / HomeComparison) */
function createSingleComponentSection(
  Component: React.ComponentType,
  labelKey: string,
  fallbackLabel: string,
): React.ComponentType<SectionProps> {
  return function SingleComponentSection({ pageIndex }: SectionProps) {
    const t = useTranslations('marketing')
    return (
      <HomeSectionFrame page={pageIndex} ariaLabel={t(labelKey, { fallback: fallbackLabel })}>
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-4 min-[768px]:px-8 min-[768px]:py-6">
          <div className="w-full">
            <Component />
          </div>
        </div>
      </HomeSectionFrame>
    )
  }
}

/** Page 6: 4 定价卡 + 4 Stat 数据条 + 品牌跑马灯 */
function PricingSection({ pageIndex }: SectionProps) {
  const t = useTranslations('marketing')
  const te = useTranslations('enterprise')
  return (
    <HomeSectionFrame page={pageIndex} ariaLabel={t('pricing.title', { fallback: 'Pricing' })}>
      <div className="relative z-10 flex h-full w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
        <div className="w-full">
          <HomePage4Pricing />
        </div>
        <div className="mx-auto w-full max-w-5xl px-4">
          <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-2 min-[768px]:gap-3 min-[1024px]:grid-cols-4">
            {[
              { value: 8, suffix: '', label: t('stats.platforms') },
              { value: 100, suffix: '+', label: t('stats.models') },
              { value: 6000, prefix: '¥', label: te('hero.priceEarlyBird') },
              { value: 18, suffix: '', label: t('stats.seats') },
            ].map((s, i) => (
              <RevealOnView
                key={i}
                delay={0.2 + 0.08 * i}
                className="group relative flex flex-col items-center gap-0.5 overflow-hidden rounded-lg border bg-card/80 px-3 py-2 text-center backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 min-[768px]:py-3"
              >
                <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-xl font-bold tracking-tight text-transparent transition-transform duration-300 group-hover:scale-110 min-[768px]:text-2xl">
                  {s.prefix && <span>{s.prefix}</span>}
                  <AnimatedNumber value={s.value} duration={1500} />
                  {s.suffix && <span>{s.suffix}</span>}
                </span>
                <span className="line-clamp-2 text-[10px] text-muted-foreground min-[768px]:text-xs">
                  {s.label}
                </span>
              </RevealOnView>
            ))}
          </div>
        </div>
        <RevealOnView as="div" delay={0.3} className="w-full max-w-7xl px-4">
          <BrandMarquee />
        </RevealOnView>
      </div>
    </HomeSectionFrame>
  )
}

/** Page 7: Magazine 新闻 + (可选) Footer */
function MagazineSection({ showFooter, pageIndex }: SectionProps) {
  const t = useTranslations('marketing')
  return (
    // 2026-08-12 v2 改(用户三次反馈"section、div 内容总跑到最后一页"根因):
    // 上一版去掉 minHeight 让 page-7 高度 = 内容自然高度 ≈ 472px(< 视口 742px),
    // 导致翻到 page-7 时,scrollIntoView 把 page-7 贴到 scrollTop=maxScrollTop 处,
    // 但因为 page-7 高度 < 视口,snap-proximity 不强制对齐,page-6 底部 320px
    // 残留在 page-7 视口顶部,page-6 的 4 stat 卡 + 品牌跑马灯等"漏"到 page-7 视口
    // 看起来"section、div 内容总跑到最后一页"。本次恢复 minHeight 强制 page-7
    // 高度 = 视口高度,与 page-1~6 走 HomeSectionFrame 的行为完全一致,snap
    // 对齐严格,page-6 不会"漏"到 page-7。
    //
    // 布局策略(minHeight 强制 ≥ 视口,但 footer 不硬贴屏底):
    // - section minHeight = calc(100vh - 58px):保证 snap 对齐严格
    // - section 用 flex flex-col:内容自然流,footer 不强制底部
    // - 内部 div 用 flex-1 撑开剩余空间(让内容在视觉上居中或上对齐,不出现
    //   "内容全在顶部,底部一大片空白"的不雅观;min-h-0 让 flex-1 在父
    //   容器高度固定时不溢出)
    // - 内容(magazine + footer)总高若 > 视口,section 高度自动扩张,内层
    //   overflow-y-auto 让用户在 page-7 内滚动(但 snap 行为由外层 main 控,
    //   仍归属 page-7)
    // - 内容 < 视口时,minHeight 撑到 742px,内容靠上布局,底部空 8px 由外层
    //   layout pb-2 提供(2026-07-31 第十六次微调已保留)
    //
    // 2026-08-12 v1(已废弃):去掉 minHeight → page-7 高度 472px,page-6 底部泄漏
    // 2026-08-12 v1 配套(已废弃):加 relative overflow-hidden min-h-0 → 治标不治本,
    //   page-7 仍 < 视口,snap 行为仍异常
    <section
      id={`home-page-${pageIndex}`}
      className="relative flex snap-start flex-col overflow-hidden min-h-[calc(100vh-58px)]"
      aria-label={t('magazine.title', { fallback: 'News' })}
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-2 min-[768px]:px-8 min-[768px]:pt-5 min-[768px]:pb-2">
        <HomePage3Magazine />
      </div>
      {showFooter && <SiteFooter className="mt-0" />}
    </section>
  )
}

/** 组件注册表:component type → React 组件(新增 section 只需在此注册) */
const sectionRegistry: Record<SectionComponentType, React.ComponentType<SectionProps>> = {
  hero: HeroSection,
  featureGrid: createSingleComponentSection(HomeFeatureGrid, 'features.title', 'Features'),
  scenarios: createSingleComponentSection(HomeScenarios, 'scenarios.title', 'Scenarios'),
  roi: createSingleComponentSection(HomeRoi, 'roi.title', 'ROI'),
  comparison: createSingleComponentSection(HomeComparison, 'comparison.title', 'Comparison'),
  pricing: PricingSection,
  magazine: MagazineSection,
}

interface SchemaDrivenSectionsProps {
  schema: HomeSchema
  /** 是否渲染 SiteFooter(营销页 true,工作区首页 false) */
  showFooter?: boolean
}

/** Schema 驱动的 section 渲染器:遍历 schema.sections,跳过 disabled,按顺序渲染 */
export function SchemaDrivenSections({ schema, showFooter = true }: SchemaDrivenSectionsProps) {
  let pageIndex = 0
  return (
    <>
      {schema.sections.map((section) => {
        if (!section.enabled) return null
        pageIndex += 1
        const SectionComponent = sectionRegistry[section.component]
        if (!SectionComponent) return null
        return <SectionComponent key={section.id} showFooter={showFooter} pageIndex={pageIndex} />
      })}
    </>
  )
}
