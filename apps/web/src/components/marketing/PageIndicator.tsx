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
 * 2026-07-21 v7 缩窄精致化:用户反馈"容器太宽了 请缩窄 精致点"。
 *   - 容器内边距 px-1 (4px) → px-0.5 (2px),总宽 28px → 20px (-29%)
 *   - button 命中区 h-5 w-5 (20×20) → h-4 w-4 (16×16),点保持原大小
 *   - active 竖向胶囊 h-5 w-2 (20×2) → h-4 w-1.5 (16×1.5),比例缩窄
 *   - gap 6px (1.5) → 4px (1),更紧凑
 *   - py-2 (8px) → py-1.5 (6px),上下更贴圆点
 *   - 整体精致度提升,点与点间节奏更紧凑
 *
 * 2026-07-20 v6 毛玻璃容器:用户反馈"圆点裸浮在内容上缺少承载感"。
 *   - 容器加 rounded-md + bg-background/65 + backdrop-blur-md
 *   - 极轻 border-foreground/8 + shadow-sm
 *   - group/indicator 命名空间避免与按钮内 group 冲突
 */
export function PageIndicator({ current, total, onClick }: PageIndicatorProps) {
  const t = useTranslations('marketing.indicator')
  if (total <= 1) return null
  return (
    <div
      // 2026-07-21 v7:缩窄精致化 - px-1→px-0.5,py-2→py-1.5,gap-1.5→gap-1
      className="group/indicator fixed right-6 top-1/2 z-sticky hidden -translate-y-1/2 flex-col gap-1 rounded-md border border-foreground/8 bg-background/65 px-0.5 py-1.5 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-foreground/15 hover:bg-background/85 hover:shadow-md md:flex"
      aria-label={t('label')}
    >
      {Array.from({ length: total }).map((_, idx) => {
        const isActive = idx === current
        return (
          // 2026-07-21 v7:button 命中区 h-5 w-5 → h-4 w-4,缩窄但不损失点击
          <button
            key={idx}
            type="button"
            onClick={() => onClick(idx)}
            aria-label={t('switchTo', { index: idx + 1 })}
            aria-current={isActive ? 'true' : undefined}
            className="group flex h-4 w-4 items-center justify-center"
          >
            <span
              // 2026-07-21 v8:拆分 isActive 两套完整 className — 修 bug
              // 旧实现模板字符串拼接导致 h-4 / h-2、w-1.5 / w-2 同元素冲突,Tailwind 源序后值获胜
              // → 非激活态被拉成 16x8 竖向胶囊,所有点都成椭圆。修复后非激活 8x8 圆点、激活 16x6 胶囊。
              // 2026-07-21 v7:active 竖向胶囊 h-5 w-2 → h-4 w-1.5,精致比例
              // 豁免 5b:竖向装饰指示器(width<=8px height>=12px rounded-full),分页指示器胶囊
              className={
                isActive
                  ? 'block h-4 w-1.5 rounded-full bg-foreground transition-all duration-300'
                  : 'block h-2 w-2 rounded-full bg-foreground/30 transition-all duration-300 group-hover:h-2.5 group-hover:w-2.5 group-hover:bg-foreground/60'
              }
            />
          </button>
        )
      })}
    </div>
  )
}
