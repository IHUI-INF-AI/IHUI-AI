'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface HoverPreviewCardProps {
  visible: boolean
  position: { x: number; y: number }
  content: React.ReactNode
  className?: string
  'data-testid'?: string
}

export const HoverPreviewCard = React.memo(function HoverPreviewCard({
  visible,
  position,
  content,
  className,
  'data-testid': testId,
}: HoverPreviewCardProps) {
  if (!visible) return null
  return (
    <div
      className={cn(
        'pointer-events-none fixed z-[1000] w-[240px] rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md',
        className,
      )}
      style={{ left: position.x, top: position.y }}
      data-testid={testId ?? 'hover-preview-card'}
      role="tooltip"
    >
      {content}
    </div>
  )
})

export default HoverPreviewCard
