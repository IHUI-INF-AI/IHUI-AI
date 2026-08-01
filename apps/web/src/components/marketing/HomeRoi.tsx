'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { BarChart3, BookOpen, Brain, Rocket, ShieldCheck, TrendingUp, Users, type LucideIcon } from 'lucide-react'
import { AnimatedNumber, RevealOnView } from '@/components/common'

/**
 * 第 4 页:8 项可量化 ROI + 计算公式
 *
 * 2026-07-29 杂志风改版:
 * - 编辑式章节标题(大号 ghost 数字 04)
 * - 大号数值展示(gradient text + AnimatedNumber 数字动画)
 * - 计算公式用 monospace 风格框
 * - hover 光泽扫过 + 数值微脉冲
 * - staggered 入场
 * - Ghost 编号(01-08)
 */

interface RoiItem {
  icon: LucideIcon
  title: string
  value: string
  description: string
  calculation: string
  /** 从 value 中提取的数字部分(用于 AnimatedNumber) */
  numericValue: number | null
  /** value 前缀(如 ¥) */
  prefix: string
  /** value 后缀(如 /年) */
  suffix: string
}

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

const ROI_I18N_KEY: Record<string, { title: string; value: string; description: string; calculation: string }> = {
  cost: { title: 'cost.title', value: 'cost.value', description: 'cost.description', calculation: 'cost.calculation' },
  speed: { title: 'speed.title', value: 'speed.value', description: 'speed.description', calculation: 'speed.calculation' },
  cache: { title: 'cache.title', value: 'cache.value', description: 'cache.description', calculation: 'cache.calculation' },
  quality: { title: 'quality.title', value: 'quality.value', description: 'quality.description', calculation: 'quality.calculation' },
  sla: { title: 'sla.title', value: 'sla.value', description: 'sla.description', calculation: 'sla.calculation' },
  learning: { title: 'learning.title', value: 'learning.value', description: 'learning.description', calculation: 'learning.calculation' },
  models: { title: 'models.title', value: 'models.value', description: 'models.description', calculation: 'models.calculation' },
  seats: { title: 'seats.title', value: 'seats.value', description: 'seats.description', calculation: 'seats.calculation' },
}

/**
 * 从 value 字符串中提取数字部分 + 前缀 + 后缀,用于 AnimatedNumber 动画。
 * 例:"省 ¥18-30 万/年" → numericValue=30, prefix="省 ¥", suffix=" 万/年"
 *     "10× 加速" → numericValue=10, prefix="", suffix="× 加速"
 *     "99.9% SLA" → numericValue=99, prefix="", suffix=".9% SLA"(取整数部分)
 */
function parseValue(raw: string): { numericValue: number | null; prefix: string; suffix: string; displayValue: string } {
  // 匹配第一个数字
 const match = raw.match(/(\d+)/)
  if (!match) return { numericValue: null, prefix: '', suffix: '', displayValue: raw }
  // match[1] 必非空(正则 \d+ 至少匹配 1 位数字),用 ! 断言避免 TS18048 误报
  const numStr = match[1]!
  const num = parseInt(numStr, 10)
  const idx = match.index ?? 0
  const prefix = raw.slice(0, idx)
  const suffix = raw.slice(idx + numStr.length)
  return { numericValue: num, prefix, suffix, displayValue: raw }
}

export function HomeRoi() {
  const t = useTranslations('marketing.roi')

  const rois: RoiItem[] = ROI_KEYS.map(({ key, icon }) => {
    const i18nKey = ROI_I18N_KEY[key]
    const rawValue = t(i18nKey?.value ?? 'unknown.value')
    const parsed = parseValue(rawValue)
    return {
      icon,
      title: t(i18nKey?.title ?? 'unknown.title'),
      value: rawValue,
      description: t(i18nKey?.description ?? 'unknown.description'),
      calculation: t(i18nKey?.calculation ?? 'unknown.calculation'),
      numericValue: parsed.numericValue,
      prefix: parsed.prefix,
      suffix: parsed.suffix,
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
          04
        </div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h2>
        <h3 className="font-edix text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t('titleEn')}
        </h3>
        <p className="mx-auto max-w-3xl text-sm text-muted-foreground sm:text-base">
          {t('subtitle')}
        </p>
      </RevealOnView>

      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 min-[768px]:grid-cols-2 md:gap-4 tablet-lg:grid-cols-4">
        {rois.map(({ icon: Icon, title, value, description, calculation, numericValue, prefix, suffix }, i) => (
          <RevealOnView
            key={title}
            delay={0.06 * (i + 1)}
            className="group relative flex flex-col items-center gap-1.5 overflow-hidden rounded-lg border bg-muted/30 p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:bg-primary/3 hover:shadow-xl hover:shadow-primary/5 sm:p-5"
          >
            {/* Ghost 编号 */}
            <span
              className="font-edix pointer-events-none absolute right-2 top-0.5 text-3xl font-bold leading-none text-foreground/5 transition-opacity duration-300 group-hover:text-foreground/10"
              aria-hidden="true"
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            {/* 光泽扫过 */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </div>

            {/* 图标 */}
            <div className="relative flex h-9 w-9 items-center justify-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/18">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>

            {/* 大号数值 — gradient text + AnimatedNumber */}
            <span className="animate-mag-value-glow bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-base font-bold leading-tight tracking-tight text-transparent transition-transform duration-300 group-hover:scale-105 sm:text-lg">
              {numericValue !== null ? (
                <>
                  {prefix && <span>{prefix}</span>}
                  <AnimatedNumber value={numericValue} duration={1500} />
                  {suffix && <span>{suffix}</span>}
                </>
              ) : (
                value
              )}
            </span>

            {/* 标题 */}
            <h3 className="font-edix text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {title}
            </h3>

            {/* 描述 */}
            <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">{description}</p>

            {/* 计算公式 — monospace 风格 */}
            <p className="mt-auto rounded bg-background/60 px-2 py-1.5 font-mono text-[9px] leading-relaxed text-muted-foreground/60 sm:text-[10px]">
              {calculation}
            </p>
          </RevealOnView>
        ))}
      </div>
    </section>
  )
}
