'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  BarChart3,
  BookOpen,
  Brain,
  Check,
  Lightbulb,
  Rocket,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * 第 3 页:5 大决策者场景 + 8 项可量化 ROI + 8 行竞品对比
 *
 * 让决策者一眼看到:
 *  - 5 大场景:降本/提效/学习/创新/决策(每个有具体收益)
 *  - 8 项 ROI:省 ¥18-30 万/年、10× 加速、60% 降本、99.9% SLA 等
 *  - 8 行竞品对比:智汇 AI vs Claude Code vs Cursor vs ChatGPT
 *
 * 2026-07-20 立:用户反馈"功能不全 不细致 优势没说明明"
 * → 新增此组件展示场景化价值主张 + 量化 ROI + 竞品对比
 */

interface ScenarioItem {
  icon: LucideIcon
  title: string
  painPoint: string
  description: string
  benefit: string
}

interface RoiItem {
  icon: LucideIcon
  title: string
  value: string
  description: string
  calculation: string
}

const SCENARIO_KEYS = [
  { key: 'costReduction', icon: TrendingUp },
  { key: 'efficiency', icon: Zap },
  { key: 'learning', icon: BookOpen },
  { key: 'innovation', icon: Lightbulb },
  { key: 'decision', icon: Target },
] as const

const ROI_KEYS = [
  { key: 'cost', icon: TrendingUp },
  { key: 'speed', icon: Rocket },
  { key: 'cache', icon: BarChart3 },
  { key: 'quality', icon: ShieldCheck },
  { key: 'sla', icon: ShieldCheck },
  { key: 'learning', icon: BookOpen },
  { key: 'models', icon: Brain },
  { key: 'seats', icon: Users },
] as const

const COMPARISON_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export function HomeScenarioGrid() {
  const t = useTranslations('marketing.scenarios')
  const tr = useTranslations('marketing.roi')
  const tc = useTranslations('marketing.comparison')

  const scenarios: ScenarioItem[] = SCENARIO_KEYS.map(({ key, icon }) => ({
    icon,
    title: t(`${key}.title`),
    painPoint: t(`${key}.painPoint`),
    description: t(`${key}.description`),
    benefit: t(`${key}.benefit`),
  }))

  const rois: RoiItem[] = ROI_KEYS.map(({ key, icon }) => ({
    icon,
    title: tr(`${key}.title`),
    value: tr(`${key}.value`),
    description: tr(`${key}.description`),
    calculation: tr(`${key}.calculation`),
  }))

  return (
    <section className="space-y-5">
      {/* 5 大决策者场景:痛点 → 解决 → 收益 */}
      <div className="space-y-2">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t('title')}</h2>
          <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
            {t('titleEn')}
          </h3>
          <p className="mx-auto max-w-3xl text-xs text-muted-foreground sm:text-sm">
            {t('subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-5">
          {scenarios.map(({ icon: Icon, title, painPoint, description, benefit }) => (
            <div
              key={title}
              className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 sm:p-3.5"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <h3 className="text-xs font-semibold leading-tight sm:text-sm">{title}</h3>
              </div>
              <p className="line-clamp-2 rounded bg-destructive/5 px-1.5 py-1 text-[10px] text-destructive/80 sm:text-[11px]">
                {painPoint}
              </p>
              <p className="line-clamp-3 text-[10px] text-muted-foreground sm:text-[11px]">
                {description}
              </p>
              <p className="line-clamp-2 rounded bg-primary/5 px-1.5 py-1 text-[10px] font-medium text-primary sm:text-[11px]">
                {benefit}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 8 项可量化 ROI + 计算公式 */}
      <div className="space-y-2">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{tr('title')}</h2>
          <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
            {tr('titleEn')}
          </h3>
          <p className="mx-auto max-w-3xl text-xs text-muted-foreground sm:text-sm">
            {tr('subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {rois.map(({ icon: Icon, title, value, description, calculation }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-1 rounded-lg border bg-muted/40 p-3 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 sm:p-3.5"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
              <span className="text-sm font-bold leading-tight tracking-tight text-primary sm:text-base">
                {value}
              </span>
              <h3 className="text-[11px] font-semibold leading-tight sm:text-xs">{title}</h3>
              <p className="line-clamp-2 text-[10px] text-muted-foreground sm:text-[11px]">
                {description}
              </p>
              <p className="line-clamp-3 rounded bg-background/80 px-1.5 py-1 text-[9px] text-muted-foreground/70 sm:text-[10px]">
                {calculation}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 竞品对比表(10 行) */}
      <div className="space-y-2">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{tc('title')}</h2>
          <h3 className="font-edix text-xs uppercase tracking-wider text-muted-foreground">
            {tc('titleEn')}
          </h3>
          <p className="mx-auto max-w-3xl text-xs text-muted-foreground sm:text-sm">
            {tc('subtitle')}
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-[10px] sm:text-xs">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-2 py-1.5 font-semibold sm:px-3 sm:py-2">{tc('colFeature')}</th>
                <th className="bg-primary/10 px-2 py-1.5 font-semibold text-primary sm:px-3 sm:py-2">
                  {tc('colUs')}
                </th>
                <th className="px-2 py-1.5 font-semibold sm:px-3 sm:py-2">{tc('colClaude')}</th>
                <th className="px-2 py-1.5 font-semibold sm:px-3 sm:py-2">{tc('colCursor')}</th>
                <th className="px-2 py-1.5 font-semibold sm:px-3 sm:py-2">{tc('colChatgpt')}</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((n) => {
                const us = tc(`row${n}Us`)
                return (
                  <tr key={n} className="border-t">
                    <td className="px-2 py-1.5 font-medium sm:px-3 sm:py-2">
                      {tc(`row${n}Feature`)}
                    </td>
                    <td className="bg-primary/5 px-2 py-1.5 font-medium text-primary sm:px-3 sm:py-2">
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                        <span className="truncate">{us}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground sm:px-3 sm:py-2">
                      <div className="flex items-center gap-1">
                        {tc(`row${n}Claude`) === '无' ? (
                          <X
                            className="h-3 w-3 shrink-0 text-muted-foreground/60"
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="truncate">{tc(`row${n}Claude`)}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground sm:px-3 sm:py-2">
                      <div className="flex items-center gap-1">
                        {tc(`row${n}Cursor`) === '无' ? (
                          <X
                            className="h-3 w-3 shrink-0 text-muted-foreground/60"
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="truncate">{tc(`row${n}Cursor`)}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground sm:px-3 sm:py-2">
                      <div className="flex items-center gap-1">
                        {tc(`row${n}Chatgpt`) === '无' ? (
                          <X
                            className="h-3 w-3 shrink-0 text-muted-foreground/60"
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="truncate">{tc(`row${n}Chatgpt`)}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
