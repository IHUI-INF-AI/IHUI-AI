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
 * - 紧凑点列:点 4px / 间距 6px / active 变 12px 长条但仅 2px 宽
 * - hover 放大,点击跳转
 * - 移动端隐藏
 *
 * 2026-07-20 改:容器从 h-6 gap-2.5(高 24/间距 10)缩到 h-3 gap-1.5(高 12/间距 6),
 * 点从 1.5×1.5 缩到 1×1,active 从 h-6 w-1.5(24×6)缩到 h-3 w-0.5(12×2),
 * 整体更紧凑精致,符合用户"间距太大、太难看"反馈。
 */
export function PageIndicator({ current, total, onClick }: PageIndicatorProps) {
  const t = useTranslations('marketing.indicator')
  if (total <= 1) return null
  return (
    <div
      className="fixed right-6 top-1/2 z-sticky hidden -translate-y-1/2 flex-col gap-1.5 md:flex"
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
            className="group flex h-3 w-2 items-center justify-center"
          >
            <span
              className={`block transition-all duration-300 ${
                isActive
                  ? 'h-3 w-0.5 bg-primary'
                  : 'h-1 w-1 bg-muted-foreground/40 group-hover:bg-muted-foreground/70'
              }`}
              style={{ borderRadius: '1px' }}
            />
          </button>
        )
      })}
    </div>
  )
}
