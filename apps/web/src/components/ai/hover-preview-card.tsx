'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * HoverPreviewCard — Hover 预览卡片(2026-07-28 立,Trae Work 对齐)
 *
 * 设计目标:
 * - 鼠标悬停在 PlanStep/Subagent/Tool 时浮出 200x120 缩略卡片
 * - 与 useHoverPreview hook 配合使用
 * - 移入卡片不立即关闭(hovering 状态)
 */

interface HoverPreviewCardProps {
  visible: boolean
  position: { x: number; y: number }
  content: React.ReactNode
  width?: number
  height?: number
  onClose?: () => void
  className?: string
}

export const HoverPreviewCard = React.memo(function HoverPreviewCard({
  visible,
  position,
  content,
  width = 240,
  height = 140,
  onClose,
  className,
}: HoverPreviewCardProps) {
  const closeTimerRef = React.useRef<number | null>(null)
  const [hovering, setHovering] = React.useState(false)

  const clearClose = React.useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleClose = React.useCallback(() => {
    clearClose()
    closeTimerRef.current = window.setTimeout(() => {
      setHovering(false)
      onClose?.()
    }, 100)
  }, [clearClose, onClose])

  React.useEffect(() => {
    return () => clearClose()
  }, [clearClose])

  if (!visible && !hovering) return null

  return (
    <div
      data-testid="hover-preview-card"
      role="tooltip"
      style={
        {
          position: 'fixed',
          top: position.y,
          left: position.x,
          width,
          minHeight: height,
          zIndex: 9999,
        } as React.CSSProperties
      }
      onMouseEnter={() => {
        setHovering(true)
        clearClose()
      }}
      onMouseLeave={scheduleClose}
      className={cn(
        'rounded-md border border-border bg-card p-2 text-[11px] text-foreground/90 shadow-lg',
        className,
      )}
    >
      {content}
    </div>
  )
})
