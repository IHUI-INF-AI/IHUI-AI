'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { BarChart3, BookOpen, Brain, Rocket, ShieldCheck, TrendingUp, Users, type LucideIcon } from 'lucide-react'
import { RevealOnView } from '@/components/common'

/**
 * 第 4 页:8 项可量化 ROI + 计算公式
 *
 * 2026-07-21 拆分(从原 HomeScenarioGrid 抽出):
 * - 用户反馈"内容太拥挤了,再分个页面出来"
 * - 8 ROI 卡片独立成页,字号 / 间距 / 公式可读性都提升一档
 * - 让决策者聚焦"省多少钱 / 提多少效"两个最关心的问题
 *
 * 8 项可量化 ROI:省 ¥18-30 万/年、10× 加速、60% 降本、99.9% SLA 等
 *
 * 2026-07-23 改:卡片入场 staggered + hover 上浮 + 图标弹动 + 数字加微脉冲。
 */

interface RoiItem {
  icon: LucideIcon
  title: string
  value: string
  description: string
  calculation: string
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

export function HomeRoi() {
  const t = useTranslations('marketing.roi')

  const rois: RoiItem[] = ROI_KEYS.map(({ key, icon }) => ({
    icon,
    title: t(`${key}.title`),
    value: t(`${key}.value`),
    description: t(`${key}.description`),
    calculation: t(`${key}.calculation`),
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

      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {rois.map(({ icon: Icon, title, value, description, calculation }, i) => (
          <RevealOnView
            key={title}
            delay={0.05 * (i + 1)}
            className="group relative flex flex-col items-center gap-1.5 overflow-hidden rounded-lg border bg-muted/40 p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 sm:p-5"
          >
            {/* 卡片顶部渐变高光 */}
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            {/* 图标背景圆 - 渐变背景 + hover 放大旋转 */}
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 to-emerald-500/10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-base font-bold leading-tight tracking-tight text-transparent transition-transform duration-300 group-hover:scale-105 sm:text-lg">
              {value}
            </span>
            <h3 className="text-xs font-semibold leading-tight sm:text-sm">{title}</h3>
            <p className="text-[11px] text-muted-foreground sm:text-xs">{description}</p>
            <p className="rounded bg-background/80 px-2 py-1.5 text-[10px] text-muted-foreground/70 sm:text-[11px]">
              {calculation}
            </p>
          </RevealOnView>
        ))}
      </div>
    </section>
  )
}
