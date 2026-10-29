// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { ActivityVirtualList } from './activity-virtual-list'

export interface ShowMoreListProps<T> {
  items: T[]
  /** 初始展示数量,超过则出现"更多"按钮 */
  initialCount?: number
  renderItem: (item: T, index: number) => React.ReactNode
  /** "更多"按钮文案(由调用方用 i18n 传入,本组件不碰词包) */
  moreLabel?: string
  /** "收起"按钮文案 */
  lessLabel?: string
  /**
   * 展开后的**几何虚拟化**阈值(2026-10-29 立,对标 Qoder 0.4.11 活动级虚拟化):
   * 传了就表示"展开后条目数超过本值时,只挂可见行 ± overscan"(几何驱动),
   * 不传则保持原样全量挂载(通用容器不替调用方决定性能策略)。
   * 阈值以下的条目仍走原 `.slice().map()`(短列表全量渲染更跟手)。
   */
  virtualizeThreshold?: number
  /** 虚拟化档的容器最大高度类(透传给 `ActivityVirtualList`) */
  virtualizedMaxHeightClass?: string
  /** 每条的稳定键(虚拟化档必传:几何重算靠键而不是下标保位) */
  itemKeys?: readonly string[]
  className?: string
  testId?: string
}

/**
 * ShowMoreList — "更多列表"最小容器(D58 G-71/G-72)。
 *
 * 同类目较多时,先展示前 initialCount 项,点"更多"展开剩余;展开后出现"收起"。
 * 纯展示组件:文案由外部传入,不引入任何 i18n 依赖(词包改动由其他代理统一入库)。
 * 通用、无业务假设,后续其他面板(如工具清单)均可复用,无需重造。
 *
 * 2026-10-29:数量截断与几何虚拟化**分工**而非互替 —— 「更多」按钮回答"要不要展开",
 * 展开后由 `ActivityVirtualList` 回答"这一帧挂哪几行"。判据全部在
 * `./activity-virtual-window`(窗口数学复用 `@/components/chat/windowing`),本文件零复算。
 */
export function ShowMoreList<T>({
  items,
  initialCount = 5,
  renderItem,
  moreLabel = 'More',
  lessLabel = 'Less',
  virtualizeThreshold,
  virtualizedMaxHeightClass,
  itemKeys,
  className,
  testId,
}: ShowMoreListProps<T>) {
  const [expanded, setExpanded] = React.useState(false)
  const base = testId ?? 'show-more-list'
  const visibleCount = expanded ? items.length : Math.min(initialCount, items.length)
  const hiddenCount = items.length - visibleCount
  const virtualize =
    virtualizeThreshold !== undefined && expanded && items.length > virtualizeThreshold

  return (
    <div className={cn('space-y-1', className)} data-testid={base}>
      {virtualize ? (
        <ActivityVirtualList
          items={items}
          itemKeys={itemKeys}
          renderItem={renderItem}
          threshold={virtualizeThreshold}
          maxHeightClass={virtualizedMaxHeightClass}
          testId={`${base}-virtual`}
        />
      ) : (
        items.slice(0, visibleCount).map((item, i) => renderItem(item, i))
      )}

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
