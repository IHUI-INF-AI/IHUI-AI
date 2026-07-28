'use client'

import * as React from 'react'
import { Code2, Copy, Check, FileCode } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TraeCodeHeaderProps {
  language?: string
  fileName?: string
  lineCount?: number
  hideCopy?: boolean
  className?: string
  'data-testid'?: string
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
        <span className="shrink-0 tabular-nums text-muted-foreground/60">{lineCount} 行</span>
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
