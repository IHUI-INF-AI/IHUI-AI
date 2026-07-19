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
 * 右侧固定分页指示器
 * - 5 个圆点,active 时变成长条
 * - hover 放大,点击跳转
 * - 移动端隐藏
 */
export function PageIndicator({ current, total, onClick }: PageIndicatorProps) {
  const t = useTranslations('marketing.indicator')
  if (total <= 1) return null
  return (
    <div
      className="fixed right-6 top-1/2 z-sticky hidden -translate-y-1/2 flex-col gap-2.5 md:flex"
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
            className="group flex h-6 w-3 items-center justify-center"
          >
            <span
              className={`block transition-all duration-300 ${
                isActive
                  ? 'h-6 w-1.5 bg-primary'
                  : 'h-1.5 w-1.5 bg-muted-foreground/40 group-hover:bg-muted-foreground/70'
              }`}
              style={{ borderRadius: '2px' }}
            />
          </button>
        )
      })}
    </div>
  )
}
