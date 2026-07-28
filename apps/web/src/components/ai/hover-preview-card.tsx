'use client'

/**
 * HoverPreviewCard — 通用 hover 浮出预览卡(2026-07-28 立)
 *
 * Trae Work 风格:
 * - 浅色背景 + 圆角 + 阴影 + 1px 边框
 * - 200x120 默认尺寸(可通过 width/height 自定义,默认 240x140 适配更多内容)
 * - 鼠标移入卡片时取消关闭计时器(允许用户移入预览卡操作)
 * - 鼠标离开卡片时延迟关闭(避免误触)
 * - z-index: 9999,避免被遮挡
 * - role="tooltip" 支持屏幕阅读器
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface HoverPreviewCardProps {
  /** 是否显示 */
  visible: boolean
  /** 浮层位置(屏幕坐标,固定定位使用) */
  position: { x: number; y: number }
  /** 浮层内容 */
  content: React.ReactNode
  /** 容器宽度,默认 240 */
  width?: number
  /** 容器高度,默认 140 */
  height?: number
  /** 关闭回调(移开光标时由组件内部触发) */
  onClose?: () => void
  /** 关闭延迟 ms,默认 100 */
  closeDelayMs?: number
  /** 自定义 z-index,默认 9999 */
  zIndex?: number
  /** 自定义 className */
  className?: string
  /** 自定义 data-testid */
  'data-testid'?: string
}

export const HoverPreviewCard = React.memo(function HoverPreviewCard({
  visible,
  position,
  content,
  width = 240,
  height = 140,
  onClose,
  closeDelayMs = 100,
  zIndex = 9999,
  className,
  'data-testid': testId = 'hover-preview-card',
}: HoverPreviewCardProps) {
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleClose = React.useCallback(() => {
    clearCloseTimer()
    if (onClose === undefined) return
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      onClose()
    }, closeDelayMs)
  }, [clearCloseTimer, closeDelayMs, onClose])

  React.useEffect(() => {
    return () => clearCloseTimer()
  }, [clearCloseTimer])

  if (!visible) return null

  return (
    <div
      data-testid={testId}
      role="tooltip"
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        width,
        height,
        zIndex,
      }}
      className={cn(
        'rounded-md border border-border bg-card text-card-foreground shadow-lg',
        'pointer-events-auto overflow-hidden',
        className,
      )}
      onMouseEnter={clearCloseTimer}
      onMouseLeave={scheduleClose}
    >
      <div className="h-full w-full overflow-hidden p-2 text-xs leading-relaxed text-foreground/90">
        {content}
      </div>
    </div>
  )
})

export default HoverPreviewCard
