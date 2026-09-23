// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]: D58 工具类目聚合层 (2026-09-23 · G-71/G-72)

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ShowMoreListProps<T> {
  items: T[]
  /** 初始展示数量,超过则出现"更多"按钮 */
  initialCount?: number
  renderItem: (item: T, index: number) => React.ReactNode
  /** "更多"按钮文案(由调用方用 i18n 传入,本组件不碰词包) */
  moreLabel?: string
  /** "收起"按钮文案 */
  lessLabel?: string
  className?: string
  testId?: string
}

/**
 * ShowMoreList — "更多列表"最小容器(D58 G-71/G-72)。
 *
 * 同类目较多时,先展示前 initialCount 项,点"更多"展开剩余;展开后出现"收起"。
 * 纯展示组件:文案由外部传入,不引入任何 i18n 依赖(词包改动由其他代理统一入库)。
 * 通用、无业务假设,后续其他面板(如工具清单)均可复用,无需重造。
 */
export function ShowMoreList<T>({
  items,
  initialCount = 5,
  renderItem,
  moreLabel = 'More',
  lessLabel = 'Less',
  className,
  testId,
}: ShowMoreListProps<T>) {
  const [expanded, setExpanded] = React.useState(false)
  const base = testId ?? 'show-more-list'
  const visibleCount = expanded ? items.length : Math.min(initialCount, items.length)
  const hiddenCount = items.length - visibleCount

  return (
    <div className={cn('space-y-1', className)} data-testid={base}>
      {items.slice(0, visibleCount).map((item, i) => renderItem(item, i))}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          data-testid={`${base}-more`}
          className="inline-flex items-center gap-1 rounded-sm px-1 text-[11px] text-muted-foreground/60 transition-colors hover:text-foreground/90 focus-visible:outline-none"
        >
          {moreLabel} ({hiddenCount})
        </button>
      )}

      {expanded && items.length > initialCount && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          data-testid={`${base}-less`}
          className="inline-flex items-center gap-1 rounded-sm px-1 text-[11px] text-muted-foreground/60 transition-colors hover:text-foreground/90 focus-visible:outline-none"
        >
          {lessLabel}
        </button>
      )}
    </div>
  )
}
