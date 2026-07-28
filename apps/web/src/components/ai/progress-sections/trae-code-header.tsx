'use client'

import * as React from 'react'
import { Code2, Copy, Check, FileCode } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * TraeCodeHeader — 代码块头(2026-07-28 立,Trae Work 对齐)
 *
 * 设计:
 * - 显示文件名/语言标签 + 复制按钮
 * - 与 Trae Work 代码块样式一致:深色或浅色头部 + 单行布局
 * - 配合 markdown 渲染(mdast)使用
 */

export interface TraeCodeHeaderProps {
  language?: string
  /** 文件名(可选,优先显示) */
  fileName?: string
  /** 代码行数(可选) */
  lineCount?: number
  /** 是否隐藏复制按钮 */
  hideCopy?: boolean
  className?: string
  'data-testid'?: string
  /** 自定义复制回调,默认复制 children string */
  text?: string
  children?: React.ReactNode
}

export const TraeCodeHeader = React.memo(function TraeCodeHeader({
  language,
  fileName,
  lineCount,
  hideCopy = false,
  className,
  'data-testid': testId,
  text,
  children,
}: TraeCodeHeaderProps) {
  const [copied, setCopied] = React.useState(false)

  const onCopy = React.useCallback(async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // 静默
    }
  }, [text])

  const Icon = fileName ? FileCode : Code2
  const label = fileName ?? language ?? 'plaintext'

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 border-b border-border/60 bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground/80',
        className,
      )}
      data-testid={testId ?? 'trae-code-header'}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate font-medium">{label}</span>
      {lineCount !== undefined && lineCount > 0 && (
        <span className="shrink-0 tabular-nums text-muted-foreground/60">
          {lineCount} 行
        </span>
      )}
      {children && <span className="flex-1 truncate">{children}</span>}
      <div className="flex-1" />
      {!hideCopy && text && (
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? '已复制' : '复制代码'}
          title={copied ? '已复制' : '复制代码'}
          className={cn(
            'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-colors hover:bg-accent hover:text-foreground',
            copied && 'text-emerald-500',
          )}
        >
          {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
        </button>
      )}
    </div>
  )
})

export default TraeCodeHeader
