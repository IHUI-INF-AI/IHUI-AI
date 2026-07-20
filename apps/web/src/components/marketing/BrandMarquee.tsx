'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { IMG_EAGER, MARQUEE_BRANDS, SCHOOL_BRANDS } from './footer-data'

/**
 * 品牌跑马灯 — 复用 SiteFooter 已配置的 logo 图片
 *
 * 数据来源:footer-data.ts 的 MARQUEE_BRANDS(= MODELS + PROMOTIONS) + SCHOOL_BRANDS
 * 确保 SiteFooter + BrandMarquee logo 单一来源,不重复造图。
 * 布局:双行跑马灯
 *   - 第 1 行:MARQUEE_BRANDS(24 张,模型 + 推广平台)
 *   - 第 2 行:SCHOOL_BRANDS(14 张,原未改架构前的完整 15 槽位跑马灯,brand4.svg 已丢失 → 14 张)
 * i18n key 复用 footer.modelItems.* + footer.promos.* + footer.marquee.{kouzi,bbxLogo,zhipu,brand8,ali,baidu,dbsfdx,gork,huawei,jldx,openai,tencent,yuanbaoxiang,yushu}。
 */

// 单行跑马灯 row — 抽出避免两行重复
// namespace: 默认 'footer'(modelItems/promos 在此),school row 显式传 'home.marquee'
function MarqueeRow({
  brands,
  loopKey,
  containerLabel,
  namespace = 'footer',
}: {
  brands: readonly { nameKey: string; src: string; mono?: boolean }[]
  loopKey: string
  containerLabel: string
  namespace?: 'footer' | 'home.marquee'
}) {
  const t = useTranslations(namespace)
  const loop = [...brands, ...brands]
  return (
    <div className="relative overflow-hidden rounded-lg border bg-card px-3 py-3">
      <span className="sr-only">{containerLabel}</span>
      <div className="flex whitespace-nowrap will-change-transform animate-marquee">
        {loop.map((brand, idx) => {
          const label = t(brand.nameKey)
          return (
            <div
              key={`${loopKey}-${brand.nameKey}-${idx}`}
              className="mx-3 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-card transition-colors hover:border-primary/40"
              title={label}
            >
              <img
                src={brand.src}
                alt={label}
                width={36}
                height={36}
                className={`h-9 w-9 object-contain${brand.mono ? ' invert dark:invert-0' : ''}`}
                {...IMG_EAGER}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BrandMarquee() {
  return (
    <section className="w-full space-y-2" aria-label="Brand marquee">
      <header className="flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground/70">
        <Sparkles className="h-3 w-3 text-primary" />
        <span>TRUSTED BY 24+ BRANDS · 14 LEGACY</span>
      </header>
      {/* 第一行:原模型 + 推广平台 */}
      <MarqueeRow
        brands={MARQUEE_BRANDS}
        loopKey="brand"
        containerLabel="Brand marquee — main row"
      />
      {/* 第二行:原版 14 槽位品牌(从 home.marquee namespace 取名) */}
      <MarqueeRow
        brands={SCHOOL_BRANDS}
        loopKey="school"
        containerLabel="Brand marquee — legacy row"
        namespace="home.marquee"
      />
    </section>
  )
}
