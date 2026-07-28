'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * CompressionDivider — 压缩分割线(2026-07-28 立,Trae Work 对齐)
 *
 * 用途:
 * - 折叠一段长对话/事件时,显示"N 条消息已折叠"作为占位
 * - 可点击展开,或用 ⌃ 符号强调这是"被压缩的区间"
 * - 禁止用 `<hr>` / `border-t`(AGENTS.md §4 分割线硬约束)
 *   → 用背景色 + 文字 + 居中布局替代分割线
 */

interface CompressionDividerProps {
  /** 折叠条数(展示为 "N 条已折叠") */
  count: number
  /** 是否可点击展开 */
  expandable?: boolean
  onExpand?: () => void
  /** 自定义文案(默认 "N 条已折叠") */
  label?: string
  className?: string
  'data-testid'?: string
}

export const CompressionDivider = React.memo(function CompressionDivider({
  count,
  expandable = true,
  onExpand,
  label,
  className,
  'data-testid': testId,
}: CompressionDividerProps) {
  if (count <= 0) return null
  const text = label ?? `${count} 条已折叠`

  if (!expandable || !onExpand) {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-1.5 py-2 text-[10px] text-muted-foreground/50',
          className,
        )}
        data-testid={testId ?? 'compression-divider'}
        role="separator"
        aria-label={text}
      >
        <span className="h-px flex-1 bg-border/50" aria-hidden />
        <span>{text}</span>
        <span className="h-px flex-1 bg-border/50" aria-hidden />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onExpand}
      className={cn(
        'group flex w-full items-center justify-center gap-1.5 py-2 text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground',
        className,
      )}
      data-testid={testId ?? 'compression-divider'}
      aria-label={`${text},点击展开`}
    >
      <span className="h-px flex-1 bg-border/50 transition-colors group-hover:bg-border" aria-hidden />
      <span className="shrink-0 font-medium">{text}</span>
      <span className="shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-y-0.5">
        ▼
      </span>
      <span className="h-px flex-1 bg-border/50 transition-colors group-hover:bg-border" aria-hidden />
    </button>
  )
})

export default CompressionDivider
