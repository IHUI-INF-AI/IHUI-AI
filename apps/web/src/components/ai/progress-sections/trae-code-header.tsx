'use client'

/**
 * TraeCodeHeader — TRAE Code 头部标识(2026-07-28 立,Phase 19.7)
 *
 * 截图特征(Trae Work AI 消息流):
 * - 左侧: 圆形深色背景头像,内含 "TRAE" 文字(或 lucide Sparkles 18px 图标)
 * - 中间: "TRAE Code" 文字(bold, 13-14px)
 * - 用 React.memo 包装,props 引用稳定时跳过重渲染
 *
 * 用法:每条 AI 消息顶部,作为身份标识
 */

import * as React from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TraeCodeHeaderProps {
  /** 名称,默认 "TRAE Code" */
  name?: string
  /** 是否使用图标头像(默认 false 显示 TRAE 文字) */
  iconAvatar?: boolean
  className?: string
  'data-testid'?: string
}

export const TraeCodeHeader = React.memo(function TraeCodeHeader({
  name = 'TRAE Code',
  iconAvatar = false,
  className,
  'data-testid': testId = 'trae-code-header',
}: TraeCodeHeaderProps) {
  return (
    <div
      className={cn('flex items-center gap-2 py-1', className)}
      data-testid={testId}
    >
      {/* 圆形头像:深色背景 + TRAE 文字 / Sparkles 图标 */}
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-bold tracking-tight text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
        aria-hidden
      >
        {iconAvatar ? (
          <Sparkles className="h-3.5 w-3.5" />
        ) : (
          <span>TR</span>
        )}
      </div>
      {/* 名称 */}
      <span className="text-[13px] font-semibold leading-none text-foreground/90">
        {name}
      </span>
    </div>
  )
})

export default TraeCodeHeader
