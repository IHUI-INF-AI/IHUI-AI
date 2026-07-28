'use client'

/**
 * HoverPreviewCard — Trae Work 风格 hover 浮出缩略卡(Phase 19.3,2026-07-28 立)
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

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
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        width,
        minHeight: height,
        zIndex: 9999,
      }}
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

export default HoverPreviewCard
