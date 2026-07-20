'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'

/**
 * 品牌跑马灯 — 复用 SiteFooter 已配置的 logo 图片
 *
 * 2026-07-20 改:之前用 i18n home.marquee.* 文字版(扣子/智谱/阿里云 等 14 个品牌名),
 * 但项目没有对应 logo 图片,只渲染文字看起来"简陋"。改为复用 SiteFooter 已有 logo:
 *   - 8 个 AI 模型 logo(/footer/model/*.png)
 *   - 16 个推广平台 logo(/footer/tuiguangpingtai/*.png)
 * 共 24 张图片做无缝滚动跑马灯。i18n key 复用 footer.modelItems.* + footer.promos.*。
 *
 * 图片来源与 SiteFooter 完全一致,确保 logo 单一来源,不重复造图。
 */
interface Brand {
  readonly nameKey: string
  readonly src: string
}

const MODELS: readonly Brand[] = [
  { nameKey: 'footer.modelItems.gpt', src: '/footer/model/2.png' },
  { nameKey: 'footer.modelItems.claude', src: '/footer/model/3x.png' },
  { nameKey: 'footer.modelItems.gemini', src: '/footer/model/4.png' },
  { nameKey: 'footer.modelItems.deepseek', src: '/footer/model/5.png' },
  { nameKey: 'footer.modelItems.qwen', src: '/footer/model/6.png' },
  { nameKey: 'footer.modelItems.doubao', src: '/footer/model/7.png' },
  { nameKey: 'footer.modelItems.llama', src: '/footer/model/8x.png' },
  { nameKey: 'footer.modelItems.mistral', src: '/footer/model/9.png' },
]

const PROMOTIONS: readonly Brand[] = [
  { nameKey: 'footer.promos.promo1', src: '/footer/tuiguangpingtai/1.png' },
  { nameKey: 'footer.promos.promo2', src: '/footer/tuiguangpingtai/2.png' },
  { nameKey: 'footer.promos.promo3', src: '/footer/tuiguangpingtai/3.png' },
  { nameKey: 'footer.promos.promo4', src: '/footer/tuiguangpingtai/4.png' },
  { nameKey: 'footer.promos.promo5', src: '/footer/tuiguangpingtai/5.png' },
  { nameKey: 'footer.promos.promo6', src: '/footer/tuiguangpingtai/6.png' },
  { nameKey: 'footer.promos.promo7', src: '/footer/tuiguangpingtai/7.png' },
  { nameKey: 'footer.promos.promo8', src: '/footer/tuiguangpingtai/8.png' },
  { nameKey: 'footer.promos.x', src: '/footer/tuiguangpingtai/9.png' },
  { nameKey: 'footer.promos.facebook', src: '/footer/tuiguangpingtai/10.png' },
  { nameKey: 'footer.promos.promo11', src: '/footer/tuiguangpingtai/11.png' },
  { nameKey: 'footer.promos.promo12', src: '/footer/tuiguangpingtai/12.png' },
  { nameKey: 'footer.promos.promo14', src: '/footer/tuiguangpingtai/14.png' },
  { nameKey: 'footer.promos.promo15', src: '/footer/tuiguangpingtai/15.png' },
  { nameKey: 'footer.promos.github', src: '/footer/tuiguangpingtai/16.png' },
  { nameKey: 'footer.promos.promo17', src: '/footer/tuiguangpingtai/17.png' },
]

const BRANDS: readonly Brand[] = [...MODELS, ...PROMOTIONS]

export function BrandMarquee() {
  const t = useTranslations()
  // 复制一份用于无缝滚动
  const loop = [...BRANDS, ...BRANDS]

  return (
    <section className="w-full space-y-2" aria-label="Brand marquee">
      <header className="flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground/70">
        <Sparkles className="h-3 w-3 text-primary" />
        <span>TRUSTED BY 24+ BRANDS</span>
      </header>
      <div className="relative overflow-hidden rounded-lg border bg-card px-3 py-2">
        <div className="flex whitespace-nowrap will-change-transform animate-marquee">
          {loop.map((brand, idx) => (
            <div
              key={`${brand.nameKey}-${idx}`}
              className="mx-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-white transition-colors hover:border-primary/40"
              title={t(brand.nameKey)}
            >
              <img
                src={brand.src}
                alt={t(brand.nameKey)}
                width={20}
                height={20}
                className="h-5 w-5 object-contain"
                loading="eager"
                decoding="sync"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
