'use client'

import * as React from 'react'
import { cn } from '../lib/utils.js'

/**
 * 可拖拽调整大小的手柄(通用组件)。
 * 抽象自 apps/web/src/components/ai/ai-side-panel.tsx 的 handleResizeStart 逻辑。
 *
 * 用法:
 * <ResizableHandle direction="left" onResize={(delta) => setWidth(w => w + delta)} />
 *
 * 圆角守门:手柄可见线用 rounded(4px),命中区无圆角(贴边)。
 * 不弹独立窗口,纯 pointer events。
 */

export interface ResizableHandleProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onResize'> {
  /** 手柄位置(决定拖拽方向) */
  direction: 'left' | 'right' | 'top' | 'bottom'
  /** 拖拽时每帧回调,delta 为像素位移(向右/下为正) */
  onResize: (delta: number) => void
  /** 拖拽开始 */
  onResizeStart?: () => void
  /** 拖拽结束 */
  onResizeEnd?: () => void
  /** 是否禁用 */
  disabled?: boolean
  /** 手柄宽度/高度(px),默认 8 */
  size?: number
}

const directionClasses: Record<ResizableHandleProps['direction'], string> = {
  left: 'cursor-ew-resize w-2 -left-1',
  right: 'cursor-ew-resize w-2 -right-1',
  top: 'cursor-ns-resize h-2 -top-1',
  bottom: 'cursor-ns-resize h-2 -bottom-1',
}

const isHorizontal = (d: ResizableHandleProps['direction']) => d === 'left' || d === 'right'

export const ResizableHandle = React.forwardRef<HTMLDivElement, ResizableHandleProps>(
  (
    {
      direction,
      onResize,
      onResizeStart,
      onResizeEnd,
      disabled,
      size = 8,
      className,
      ...rest
    },
    ref,
  ) => {
    const handlePointerDown = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) return
        e.preventDefault()
        e.stopPropagation()
        const startX = e.clientX
        const startY = e.clientY
        onResizeStart?.()

        const onMove = (ev: PointerEvent) => {
          const delta = isHorizontal(direction) ? ev.clientX - startX : ev.clientY - startY
          // 左/上方向手柄:反向(delta 取负,因为面板宽度变化与拖拽方向相反)
          const adjusted = direction === 'left' || direction === 'top' ? -delta : delta
          onResize(adjusted)
        }
        const onUp = () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          onResizeEnd?.()
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
      },
      [direction, disabled, onResize, onResizeStart, onResizeEnd],
    )

    return (
      <div
        ref={ref}
        onPointerDown={handlePointerDown}
        className={cn(
          'absolute z-10 flex items-center justify-center touch-none select-none',
          directionClasses[direction],
          disabled && 'pointer-events-none opacity-0',
          className,
        )}
        style={isHorizontal(direction) ? { width: size } : { height: size }}
        {...rest}
      >
        {/* 内层可见细线(双层 div 结构,禁用 before: 伪元素方案) */}
        <div
          className={cn(
            'rounded bg-border/50 transition-colors hover:bg-border',
            isHorizontal(direction) ? 'h-8 w-0.5' : 'w-8 h-0.5',
          )}
        />
      </div>
    )
  },
)
ResizableHandle.displayName = 'ResizableHandle'
