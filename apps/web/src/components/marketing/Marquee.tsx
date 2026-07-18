'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Megaphone } from 'lucide-react'

interface MarqueeItem {
  id: string
  text: string
}

interface MarqueeProps {
  items?: MarqueeItem[]
}

export function Marquee({ items }: MarqueeProps) {
  const t = useTranslations('marketing.marquee')
  const fallback = t.raw('items') as string[]
  const list: MarqueeItem[] =
    items && items.length > 0 ? items : fallback.map((text, i) => ({ id: String(i), text }))

  if (list.length === 0) return null

  // 复制一份用于无缝滚动
  const loop = [...list, ...list]

  return (
    <div className="flex items-center gap-2 overflow-hidden rounded-lg border bg-card px-3 py-2">
      <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
        <Megaphone className="h-3.5 w-3.5" />
        {t('label')}
      </span>
      <div className="relative flex-1 overflow-hidden">
        <div className="flex whitespace-nowrap will-change-transform animate-marquee">
          {loop.map((item, idx) => (
            <span
              key={`${item.id}-${idx}`}
              className="mx-6 inline-flex items-center text-sm text-muted-foreground"
            >
              <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary/50" />
              {item.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
