'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ArrowDown, BookOpen, Lightbulb, Target, TrendingUp, Zap, type LucideIcon } from 'lucide-react'
import { RevealOnView } from '@/components/common'

/**
 * 第 3 页:5 大决策者场景 — 痛点 → 解决 → 收益
 *
 * 2026-07-29 杂志风改版:
 * - 编辑式章节标题(大号 ghost 数字 03 + 标题)
 * - 每张卡片含 ghost 编号(01-05),hover 时编号浮现
 * - PAIN POINT / SOLUTION / BENEFIT 三段式标签(EDIX 小字)
 * - 箭头连接三段,视觉引导阅读流
 * - hover 光泽扫过 + subtle 阴影
 * - staggered blur-in 入场动画
 */

interface ScenarioItem {
  icon: LucideIcon
  title: string
  painPoint: string
  description: string
  benefit: string
}

const SCENARIO_KEYS = [
  { key: 'costReduction', icon: TrendingUp },
  { key: 'efficiency', icon: Zap },
  { key: 'learning', icon: BookOpen },
  { key: 'innovation', icon: Lightbulb },
  { key: 'decision', icon: Target },
] as const

const SCENARIO_I18N_KEY: Record<string, { title: string; painPoint: string; description: string; benefit: string }> = {
  costReduction: { title: 'costReduction.title', painPoint: 'costReduction.painPoint', description: 'costReduction.description', benefit: 'costReduction.benefit' },
  efficiency: { title: 'efficiency.title', painPoint: 'efficiency.painPoint', description: 'efficiency.description', benefit: 'efficiency.benefit' },
  learning: { title: 'learning.title', painPoint: 'learning.painPoint', description: 'learning.description', benefit: 'learning.benefit' },
  innovation: { title: 'innovation.title', painPoint: 'innovation.painPoint', description: 'innovation.description', benefit: 'innovation.benefit' },
  decision: { title: 'decision.title', painPoint: 'decision.painPoint', description: 'decision.description', benefit: 'decision.benefit' },
}

export function HomeScenarios() {
  const t = useTranslations('marketing.scenarios')

  const scenarios: ScenarioItem[] = SCENARIO_KEYS.map(({ key, icon }) => {
    const i18nKey = SCENARIO_I18N_KEY[key]
    return {
      icon,
      title: t(i18nKey?.title ?? 'unknown.title'),
      painPoint: t(i18nKey?.painPoint ?? 'unknown.painPoint'),
      description: t(i18nKey?.description ?? 'unknown.description'),
      benefit: t(i18nKey?.benefit ?? 'unknown.benefit'),
    }
  })

  return (
    <section className="relative space-y-6">
      {/* 编辑式章节标题:大号 ghost 数字 + 标题 */}
      <RevealOnView as="div" className="relative space-y-1.5 text-center">
        <div
          className="font-edix pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 select-none text-[120px] font-bold leading-none tracking-tighter text-foreground animate-mag-section-breathe sm:text-[160px]"
          aria-hidden="true"
        >
          03
        </div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h2>
        <h3 className="font-edix text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t('titleEn')}
        </h3>
        <p className="mx-auto max-w-3xl text-sm text-muted-foreground sm:text-base">
          {t('subtitle')}
        </p>
      </RevealOnView>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-5">
        {scenarios.map(({ icon: Icon, title, painPoint, description, benefit }, i) => (
          <RevealOnView
            key={title}
            delay={0.08 * (i + 1)}
            className="group relative flex flex-col gap-2.5 overflow-hidden rounded-lg border bg-card p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 sm:p-5"
          >
            {/* Ghost 编号(01-05)— hover 时浮现 */}
            <span
              className="font-edix pointer-events-none absolute right-3 top-1 text-5xl font-bold leading-none text-foreground/5 transition-opacity duration-300 group-hover:text-foreground/10"
              aria-hidden="true"
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            {/* 光泽扫过效果 */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </div>

            {/* 图标 + 标题 */}
            <div className="relative flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/18">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold leading-tight sm:text-base">{title}</h3>
            </div>

            {/* PAIN POINT */}
            <div className="relative space-y-0.5">
              <span className="font-edix text-[9px] uppercase tracking-[0.15em] text-destructive/50">
                Pain Point
              </span>
              <p className="rounded bg-destructive/5 px-2 py-1.5 text-xs leading-relaxed text-destructive/80">
                {painPoint}
              </p>
            </div>

            {/* 箭头 */}
            <ArrowDown className="mx-auto h-3 w-3 text-muted-foreground/30" aria-hidden="true" />

            {/* SOLUTION */}
            <div className="relative space-y-0.5">
              <span className="font-edix text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50">
                Solution
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{description}</p>
            </div>

            {/* 箭头 */}
            <ArrowDown className="mx-auto h-3 w-3 text-muted-foreground/30" aria-hidden="true" />

            {/* BENEFIT */}
            <div className="relative space-y-0.5">
              <span className="font-edix text-[9px] uppercase tracking-[0.15em] text-primary/50">
                Benefit
              </span>
              <p className="rounded bg-primary/5 px-2 py-1.5 text-xs font-medium leading-relaxed text-primary sm:text-sm">
                {benefit}
              </p>
            </div>
          </RevealOnView>
        ))}
      </div>
    </section>
  )
}
