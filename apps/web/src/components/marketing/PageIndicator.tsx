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
 * 2026-07-20 v5 重新调尺寸:用户反馈"圆点太小 + 间距太大"。
 *   - 默认点:8×8 圆形 bg-foreground/30(上版 6×6 偏小)
 *   - active:8×20 竖向胶囊 rounded-full bg-foreground(上版 6×16 太细)
 *   - hover:10×10 圆形 + bg-foreground/60(上版 8×8 偏小)
 *   - 容器 gap 6px(上版 8px 太宽)
 *   - button 命中区 20×20(配合新 active 高度)
 *   - 颜色:仅黑白灰(2026-07-20 v4 要求,去蓝)
 *
 * 2026-07-20 v6 毛玻璃容器:用户反馈"圆点裸浮在内容上缺少承载感"。
 *   - 容器加 rounded-xl + bg-background/65 + backdrop-blur-md
 *   - 极轻 border-foreground/8 + shadow-sm
 *   - p-2(8px) 内边距,容器内圆点自然成组
 *   - hover 容器:背景/边框加深,subtle 而不抢戏
 *   - group/indicator 命名空间避免与按钮内 group 冲突
 */
export function PageIndicator({ current, total, onClick }: PageIndicatorProps) {
  const t = useTranslations('marketing.indicator')
  if (total <= 1) return null
  return (
    <div
      className="group/indicator fixed right-6 top-1/2 z-sticky hidden -translate-y-1/2 flex-col gap-1.5 rounded-xl border border-foreground/8 bg-background/65 p-2 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-foreground/15 hover:bg-background/85 hover:shadow-md md:flex"
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
            className="group flex h-5 w-5 items-center justify-center"
          >
            <span
              className={`block rounded-full transition-all duration-300 ${
                isActive
                  ? 'h-5 w-2 bg-foreground'
                  : 'h-2 w-2 bg-foreground/30 group-hover:h-2.5 group-hover:w-2.5 group-hover:bg-foreground/60'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}
