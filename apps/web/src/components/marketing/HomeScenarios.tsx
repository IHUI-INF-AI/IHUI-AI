'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { BookOpen, Lightbulb, Target, TrendingUp, Zap, type LucideIcon } from 'lucide-react'
import { RevealOnView } from '@/components/common'

/**
 * 第 3 页:5 大决策者场景 — 痛点 → 解决 → 收益
 *
 * 2026-07-21 拆分(从原 HomeScenarioGrid 抽出):
 * - 用户反馈"内容太拥挤了,再分个页面出来"
 * - 5 场景独立占一整页,每张卡片字号 / 间距 / 行高都可放大,信息密度更舒服
 * - 后续如果再扩展场景(从 5 → 6/7)无需重构,直接扩 SCENARIO_KEYS 即可
 *
 * 让决策者一眼看到 5 大场景:降本 / 提效 / 学习 / 创新 / 决策,每个有具体收益。
 *
 * 2026-07-23 改:卡片入场 staggered + hover 上浮 + 图标弹动。
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

export function HomeScenarios() {
  const t = useTranslations('marketing.scenarios')

  const scenarios: ScenarioItem[] = SCENARIO_KEYS.map(({ key, icon }) => ({
    icon,
    title: t(`${key}.title`),
    painPoint: t(`${key}.painPoint`),
    description: t(`${key}.description`),
    benefit: t(`${key}.benefit`),
  }))

  return (
    <section className="space-y-5">
      <RevealOnView as="div" className="space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h2>
        <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
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
            delay={0.05 * (i + 1)}
            className="group flex flex-col gap-2 rounded-lg border bg-card p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md sm:p-5"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold leading-tight sm:text-base">{title}</h3>
            </div>
            <p className="rounded bg-destructive/5 px-2 py-1.5 text-xs text-destructive/80">
              {painPoint}
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
            <p className="rounded bg-primary/5 px-2 py-1.5 text-xs font-medium text-primary sm:text-sm">
              {benefit}
            </p>
          </RevealOnView>
        ))}
      </div>
    </section>
  )
}
