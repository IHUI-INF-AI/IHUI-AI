'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Boxes,
  FileImage,
  Laptop,
  ShieldCheck,
  Terminal,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { RevealOnView } from '@/components/common'

/**
 * 第 2 页:核心能力 — Bento 数字网格
 * v4 重构:8 features + 4 advantages(12 项)→ 6 个 Bento 大数字卡片
 * 极简:每卡只有 icon + title(大号 gradient) + benefit(一行小字)
 */

interface BentoItem {
  icon: LucideIcon
  title: string
  benefit: string
}

const BENTO_KEYS = [
  { key: 'modelIntegration', icon: Laptop },
  { key: 'appStore', icon: Boxes },
  { key: 'contentCreation', icon: Terminal },
  { key: 'navigation', icon: ShieldCheck },
  { key: 'workflow', icon: Workflow },
  { key: 'multimodal', icon: FileImage },
] as const

export function HomeFeatureGrid() {
  const t = useTranslations('marketing.features')

  const items: BentoItem[] = BENTO_KEYS.map(({ key, icon }) => ({
    icon,
    title: t(`${key}.title`),
    benefit: t(`${key}.benefit`),
  }))

  return (
    <section className="relative space-y-8">
      {/* 编辑式标题 */}
      <RevealOnView as="div" className="relative space-y-1.5 text-center">
        <div
          className="font-edix pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 select-none text-[120px] font-bold leading-none tracking-tighter text-foreground animate-mag-section-breathe min-[640px]:text-[160px]"
          aria-hidden="true"
        >
          02
        </div>
        <h2 className="text-2xl font-bold tracking-tight min-[640px]:text-3xl">{t('title')}</h2>
        <h3 className="font-edix text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t('titleEn')}
        </h3>
      </RevealOnView>

      {/* Bento 3×2 网格 — 大数字 + 极简标签 */}
      <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 min-[640px]:gap-4 min-[768px]:grid-cols-3">
        {items.map(({ icon: Icon, title, benefit }, i) => (
          <RevealOnView
            key={title}
            delay={0.08 * (i + 1)}
            className="group relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border bg-card p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 min-[640px]:p-8"
          >
            {/* Ghost 编号 */}
            <span
              className="font-edix pointer-events-none absolute right-3 top-1 text-4xl font-bold leading-none text-foreground/5 transition-opacity duration-300 group-hover:text-foreground/10"
              aria-hidden="true"
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            {/* 图标 */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-primary/12 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/18">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>

            {/* 大号标题 — gradient text */}
            <span className="animate-mag-value-glow line-clamp-2 bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-xl font-bold leading-tight tracking-tight text-transparent transition-transform duration-300 group-hover:scale-105 min-[640px]:text-2xl">
              {title}
            </span>

            {/* 收益标签 */}
            <span className="text-[11px] font-medium text-muted-foreground min-[640px]:text-xs">
              {benefit}
            </span>
          </RevealOnView>
        ))}
      </div>
    </section>
  )
}
