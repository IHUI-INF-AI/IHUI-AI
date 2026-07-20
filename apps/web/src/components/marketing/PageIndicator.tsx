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
 * 2026-07-20 v4 重设计:用户要求 active 圆点竖向拉长 + 颜色仅黑白灰(去蓝)。
 *   - 默认点:6×6 圆形(rounded-full 装饰点豁免) bg-foreground/30
 *   - active:6×16 竖向胶囊 rounded-full bg-foreground(竖向 = 高度大于宽度)
 *   - hover:默认点 6→8 圆形 + bg-foreground/60
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
            className="group flex h-4 w-4 items-center justify-center"
          >
            <span
              className={`block rounded-full transition-all duration-300 ${
                isActive
                  ? 'h-4 w-1.5 bg-foreground'
                  : 'h-1.5 w-1.5 bg-foreground/30 group-hover:h-2 group-hover:w-2 group-hover:bg-foreground/60'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}
