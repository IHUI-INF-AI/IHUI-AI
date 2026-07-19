'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'

const BRAND_KEYS = [
  'kouzi',
  'bbxLogo',
  'brand4',
  'zhipu',
  'brand8',
  'ali',
  'baidu',
  'dbsfdx',
  'gork',
  'huawei',
  'jldx',
  'openai',
  'tencent',
  'yuanbaoxiang',
  'yushu',
] as const

export function BrandMarquee() {
  const t = useTranslations('home.marquee')
  const brands = BRAND_KEYS.map((k) => t(k))
  const loop = [...brands, ...brands]

  return (
    <section className="space-y-3" aria-label="Brand marquee">
      <header className="flex flex-col items-center gap-1 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground/70">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>TRUSTED BY 15+ BRANDS</span>
        </div>
      </header>
      <div className="relative overflow-hidden rounded-lg border bg-card px-4 py-3">
        <div className="flex whitespace-nowrap will-change-transform animate-marquee">
          {loop.map((name, idx) => (
            <span
              key={`${name}-${idx}`}
              className="mx-4 inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground/80"
            >
              <span className="h-1.5 w-1.5 rounded-sm bg-primary/50" />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
