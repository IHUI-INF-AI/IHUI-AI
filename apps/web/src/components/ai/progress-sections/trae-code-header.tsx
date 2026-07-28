'use client'

/**
 * TraeCodeHeader — Trae Code 品牌头部(Phase 19.7,2026-07-28 立)
 *
 * 每条 AI 消息顶部的品牌化标识:圆形 TRAE Code 头像 + 名称。
 * 对标 Trae Work 截图:每条 AI 回复都有 "TRAE Code" 标签。
 */

import * as React from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TraeCodeHeaderProps {
  /** 名称,默认 "TRAE Code" */
  name?: string
  /** 可选副标题(模型名 / 工作区名) */
  subtitle?: string
  className?: string
}

export const TraeCodeHeader = React.memo(function TraeCodeHeader({
  name = 'TRAE Code',
  subtitle,
  className,
}: TraeCodeHeaderProps) {
  return (
    <div
      className={cn('flex items-center gap-1.5 px-1 pb-1', className)}
      data-testid="trae-code-header"
    >
      <div
        className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground/90 text-background"
        aria-hidden
      >
        <Sparkles className="h-3 w-3" />
      </div>
      <span className="text-xs font-semibold text-foreground/90">{name}</span>
      {subtitle && (
        <span className="text-[10px] text-muted-foreground/70">· {subtitle}</span>
      )}
    </div>
  )
})

export default TraeCodeHeader
