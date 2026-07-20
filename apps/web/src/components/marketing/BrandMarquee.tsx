'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { IMG_EAGER, MARQUEE_BRANDS } from './footer-data'

/**
 * 品牌跑马灯 — 复用 SiteFooter 已配置的 logo 图片
 *
 * 数据来源:footer-data.ts 的 MARQUEE_BRANDS(= MODELS + PROMOTIONS)
 * 确保 SiteFooter + BrandMarquee logo 单一来源,不重复造图。
 * 共 24 张图片做无缝滚动跑马灯。i18n key 复用 footer.modelItems.* + footer.promos.*。
 */

export function BrandMarquee() {
  const t = useTranslations('footer')
  // 复制一份用于无缝滚动
  const loop = [...MARQUEE_BRANDS, ...MARQUEE_BRANDS]

  return (
    <section className="w-full space-y-2" aria-label="Brand marquee">
      <header className="flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground/70">
        <Sparkles className="h-3 w-3 text-primary" />
        <span>TRUSTED BY 24+ BRANDS</span>
      </header>
      <div className="relative overflow-hidden rounded-lg border bg-card px-3 py-3">
        <div className="flex whitespace-nowrap will-change-transform animate-marquee">
          {loop.map((brand, idx) => (
            <div
              key={`${brand.nameKey}-${idx}`}
              className="mx-3 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-foreground/[0.04] transition-colors hover:border-primary/40"
              title={t(brand.nameKey)}
            >
              <img
                src={brand.src}
                alt={t(brand.nameKey)}
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
                {...IMG_EAGER}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
