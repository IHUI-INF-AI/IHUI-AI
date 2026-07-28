'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * CompressionDivider — 历史对话压缩分隔线(2026-07-28 立,Trae Work 对齐)
 *
 * 设计目标:
 * - 长对话中间的视觉分隔
 * - 浅色虚线 + 中央文字
 */

interface CompressionDividerProps {
  label?: string
  className?: string
}

export const CompressionDivider = React.memo(function CompressionDivider({
  label = '历史对话已被压缩',
  className,
}: CompressionDividerProps) {
  return (
    <div
      className={cn(
        'my-2 flex items-center gap-2 text-[10px] text-muted-foreground/60',
        className,
      )}
      data-testid="compression-divider"
      role="separator"
      aria-label={label}
    >
      <span className="h-px flex-1 bg-border/60" />
      <span className="shrink-0 px-1">{label}</span>
      <span className="h-px flex-1 bg-border/60" />
    </div>
  )
})
