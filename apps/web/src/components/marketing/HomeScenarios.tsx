'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { BookOpen, Lightbulb, Target, TrendingUp, Zap, type LucideIcon } from 'lucide-react'
import { RevealOnView } from '@/components/common'

/**
 * 第 3 页:5 大决策者场景 — 痛点 → 解决 → 收益
 *
 * 2026-07-29 v2 精简版:
 * - 大留白杂志排版,每段文字精简到 10-15 字
 * - 去掉背景色块,改用竖线 + 色彩区分三段
 * - 更精致的箭头和标签
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
      {/* 编辑式章节标题 */}
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
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
          {t('subtitle')}
        </p>
      </RevealOnView>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-5">
        {scenarios.map(({ icon: Icon, title, painPoint, description, benefit }, i) => (
          <RevealOnView
            key={title}
            delay={0.08 * (i + 1)}
            className="group relative flex flex-col gap-4 overflow-hidden rounded-lg border bg-card p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 sm:p-6"
          >
            {/* Ghost 编号 */}
            <span
              className="font-edix pointer-events-none absolute right-3 top-1 text-5xl font-bold leading-none text-foreground/5 transition-opacity duration-300 group-hover:text-foreground/10"
              aria-hidden="true"
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            {/* 光泽扫过 */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </div>

            {/* 图标 + 标题 */}
            <div className="relative flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/18">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold leading-tight sm:text-base">{title}</h3>
            </div>

            {/* PAIN POINT — 竖线 + 文字,无背景色 */}
            <div className="relative flex items-start gap-2">
              <span className="mt-0.5 h-full min-h-[16px] w-0.5 shrink-0 rounded-full bg-destructive/30" />
              <div className="space-y-0.5">
                <span className="font-edix text-[9px] uppercase tracking-[0.15em] text-destructive/40">
                  Pain
                </span>
                <p className="text-xs leading-relaxed text-destructive/70">
                  {painPoint}
                </p>
              </div>
            </div>

            {/* SOLUTION */}
            <div className="relative flex items-start gap-2">
              <span className="mt-0.5 h-full min-h-[16px] w-0.5 shrink-0 rounded-full bg-muted-foreground/20" />
              <div className="space-y-0.5">
                <span className="font-edix text-[9px] uppercase tracking-[0.15em] text-muted-foreground/40">
                  Solve
                </span>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>

            {/* BENEFIT */}
            <div className="relative flex items-start gap-2">
              <span className="mt-0.5 h-full min-h-[16px] w-0.5 shrink-0 rounded-full bg-primary/30" />
              <div className="space-y-0.5">
                <span className="font-edix text-[9px] uppercase tracking-[0.15em] text-primary/40">
                  Gain
                </span>
                <p className="text-xs font-medium leading-relaxed text-primary">
                  {benefit}
                </p>
              </div>
            </div>
          </RevealOnView>
        ))}
      </div>
    </section>
  )
}
