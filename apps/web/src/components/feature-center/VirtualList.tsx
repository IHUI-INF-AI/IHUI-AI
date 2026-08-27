'use client'

import * as React from 'react'

export interface VirtualListProps<T> {
  items: T[]
  itemKey: (item: T) => string
  itemHeight: number
  className?: string
  /** 可视区域高度，默认 600 */
  viewportHeight?: number
  children: (item: T) => React.ReactNode
}

/**
 * 虚拟列表组件，仅渲染可视区域的条目，适用于长列表。
 * 通过 scrollTop 计算 startIndex/endIndex，绝对定位条目。
 */
export function VirtualList<T>({
  items,
  itemKey,
  itemHeight,
  className,
  viewportHeight = 600,
  children,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  // 2026-08-21 修复(滚动漂移):行 div 带 mb-3(0.75rem = 12px)行间距,
  // 行实际占位 = itemHeight + ROW_GAP。原实现按 itemHeight 估算 totalHeight/
  // startIndex/offsetY,与真实 DOM 占位不一致,长列表滚动时行持续向下漂移、
  // 底部出现不可达空白(漂移量 = 已滚过行数 × 12px)。
  const ROW_GAP = 12
  const pitch = itemHeight + ROW_GAP
  const totalHeight = items.length * pitch
  const startIndex = Math.max(0, Math.floor(scrollTop / pitch) - 4)
  const visibleCount = Math.ceil(viewportHeight / pitch) + 8
  const endIndex = Math.min(items.length, startIndex + visibleCount)
  const offsetY = startIndex * pitch

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const visible = items.slice(startIndex, endIndex)

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={'relative overflow-auto ' + (className ?? '')}
      style={{ height: viewportHeight, maxHeight: viewportHeight }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visible.map((item) => (
            <div key={itemKey(item)} style={{ height: itemHeight }} className="mb-3 px-1">
              {children(item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
