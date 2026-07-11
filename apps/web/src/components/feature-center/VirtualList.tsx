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

  const totalHeight = items.length * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 4)
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + 8
  const endIndex = Math.min(items.length, startIndex + visibleCount)
  const offsetY = startIndex * itemHeight

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
