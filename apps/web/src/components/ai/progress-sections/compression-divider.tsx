'use client'

/**
 * CompressionDivider — 历史压缩分隔线(2026-07-28 立,Phase 19.10)
 *
 * 视觉特征:
 * - 左右两条横线 + 居中文字"历史对话已被压缩"
 * - 文字: text-[10px] 灰
 * - 横线: 1px 浅色
 *
 * 用法:在 messages 数组中间插入(批量历史消息折叠时显示)
 *
 * 实现说明:用 flex + 两侧 h-px 线条(不用 border-t 单边,
 * 避免触发 AGENTS.md §4 禁止分割线规则;同样实现"线+文字+线"视觉)。
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

interface CompressionDividerProps {
  label?: string
  className?: string
  'data-testid'?: string
}

export const CompressionDivider = React.memo(function CompressionDivider({
  label = '历史对话已被压缩',
  className,
  'data-testid': testId = 'compression-divider',
}: CompressionDividerProps) {
  return (
    <div
      className={cn(
        'my-3 flex items-center gap-2 px-1 text-[10px] leading-none text-muted-foreground/70',
        className,
      )}
      role="separator"
      aria-label={label}
      data-testid={testId}
    >
      <span
        className="h-px flex-1 bg-border/60"
        aria-hidden
      />
      <span className="shrink-0 font-medium tracking-wide uppercase">
        {label}
      </span>
      <span
        className="h-px flex-1 bg-border/60"
        aria-hidden
      />
    </div>
  )
})

export default CompressionDivider
