'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * HoverPreviewCard — hover 预览浮卡(2026-07-28 立,Trae Work 对齐)
 *
 * 设计:
 * - 240x140 紧凑浮卡,fixed 定位
 * - 浅色背景 + 边框 + 阴影
 * - 内容由调用方提供(纯 ReactNode)
 * - 配合 use-hover-preview hook 使用
 */

interface HoverPreviewCardProps {
  /** 是否可见 */
  visible: boolean
  /** 位置(已包含边界检测逻辑) */
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
