'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, Lightbulb, TrendingUp, Zap, type LucideIcon } from 'lucide-react'
import { RevealOnView } from '@/components/common'

/**
 * 第 3 页:3 大决策者场景 — 痛点 → 收益
 * v4 重构:5 卡片(3 列)→ 3 横向编辑式卡片(宽行)
 * 极简:每卡只有 icon + title + painPoint → benefit 一行
 */

interface HeroScenario {
  icon: LucideIcon
  title: string
  painPoint: string
  benefit: string
}

const SCENARIO_KEYS = [
  { key: 'costReduction', icon: TrendingUp },
  { key: 'efficiency', icon: Zap },
  { key: 'innovation', icon: Lightbulb },
] as const

export function HomeScenarios() {
  const t = useTranslations('marketing.scenarios')

  const scenarios: HeroScenario[] = SCENARIO_KEYS.map(({ key, icon }) => ({
    icon,
    title: t(`${key}.title`),
    painPoint: t(`${key}.painPoint`),
    benefit: t(`${key}.benefit`),
  }))

  return (
    <section className="relative space-y-8">
      {/* 编辑式章节标题 */}
      <RevealOnView as="div" className="relative space-y-1.5 text-center">
        <div
          className="font-edix pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 select-none text-[120px] font-bold leading-none tracking-tighter text-foreground animate-mag-section-breathe min-[640px]:text-[160px]"
          aria-hidden="true"
        >
          03
        </div>
        <h2 className="text-2xl font-bold tracking-tight min-[640px]:text-3xl">{t('title')}</h2>
        <h3 className="font-edix text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t('titleEn')}
        </h3>
      </RevealOnView>

      {/* 3 横向编辑式卡片 */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 min-[640px]:gap-4">
        {scenarios.map(({ icon: Icon, title, painPoint, benefit }, i) => (
          <RevealOnView
            key={title}
            delay={0.1 * (i + 1)}
            className="group relative flex flex-col gap-3 overflow-hidden rounded-lg border bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 min-[640px]:flex-row min-[640px]:items-center min-[640px]:gap-4 min-[640px]:p-6"
          >
            {/* Ghost 编号 */}
            <span
              className="font-edix pointer-events-none absolute right-4 top-2 text-5xl font-bold leading-none text-foreground/5 transition-opacity duration-300 group-hover:text-foreground/10"
              aria-hidden="true"
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            {/* 图标 + 标题 */}
            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/18 min-[640px]:h-14 min-[640px]:w-14">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold leading-tight min-[640px]:text-xl">{title}</h3>
            </div>

            {/* 痛点 → 收益 */}
            <div className="relative flex items-center gap-2 text-sm min-[640px]:ml-auto min-[640px]:text-base">
              <span className="text-destructive/60">{painPoint}</span>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-muted-foreground/40"
                aria-hidden="true"
              />
              <span className="font-bold text-primary">{benefit}</span>
            </div>
          </RevealOnView>
        ))}
      </div>
    </section>
  )
}
