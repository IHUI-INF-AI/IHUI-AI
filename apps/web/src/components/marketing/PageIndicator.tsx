'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

interface PageIndicatorProps {
  /** 当前页索引(0-based) */
  current: number
  /** 总页数 */
  total: number
  /** 点击跳转到指定页(0-based) */
  onClick: (index: number) => void
}

/**
 * 右侧固定分页指示器 — 现代圆点风
 *
 * 2026-07-20 v3 重设计:之前矩形点太小太细反而难看。
 * 改为主流现代风格:
 *   - 默认点:6×6 圆形(rounded-full 装饰点豁免) bg-muted-foreground/40
 *   - active:16×6 椭圆 rounded-full bg-primary
 *   - hover:默认点变 muted-foreground/80 + 微放大到 8×8
 *   - 容器 gap 8px,button 命中区 16×10(命中精度 + 视觉紧凑)
 */
export function PageIndicator({ current, total, onClick }: PageIndicatorProps) {
  const t = useTranslations('marketing.indicator')
  if (total <= 1) return null
  return (
    <div
      className="fixed right-6 top-1/2 z-sticky hidden -translate-y-1/2 flex-col gap-2 md:flex"
      aria-label={t('label')}
    >
      {Array.from({ length: total }).map((_, idx) => {
        const isActive = idx === current
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onClick(idx)}
            aria-label={t('switchTo', { index: idx + 1 })}
            aria-current={isActive ? 'true' : undefined}
            className="group flex h-2.5 w-4 items-center justify-center"
          >
            <span
              className={`block rounded-full transition-all duration-300 ${
                isActive
                  ? 'h-1.5 w-4 bg-primary'
                  : 'h-1.5 w-1.5 bg-muted-foreground/40 group-hover:h-1.5 group-hover:w-2 group-hover:bg-muted-foreground/80'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}
