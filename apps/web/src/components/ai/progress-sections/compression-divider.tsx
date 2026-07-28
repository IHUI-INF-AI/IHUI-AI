'use client'

/**
 * CompressionDivider — 历史对话压缩分隔线(Phase 19.10,2026-07-28 立)
 *
 * 对标 Trae Work 截图:长对话中间插入"历史对话已被压缩"分隔线。
 * 视觉:左右两侧细线 + 居中文字。
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

interface CompressionDividerProps {
  /** 中间文字,默认 "历史对话已被压缩" */
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

export default CompressionDivider
