'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  /** 要复制的文本 */
  text: string
  /** 额外 className */
  className?: string
  /** aria-label */
  'aria-label'?: string
  /** data-testid */
  'data-testid'?: string
}

/**
 * CopyButton — 通用复制按钮(v11)
 *
 * 特征:
 * - 点击复制 text 到剪贴板
 * - 复制成功后显示 Check 图标 1.5s,然后恢复 Copy 图标
 * - 极小尺寸(h-4 w-4),适配紧凑布局
 * - memo 化:text 引用稳定时跳过重渲染
 */
export const CopyButton = React.memo(function CopyButton({
  text,
  className,
  'aria-label': ariaLabel = '复制',
  'data-testid': testId,
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false)

  const onCopy = React.useCallback(async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // 剪贴板 API 不可用时静默失败(测试环境/jsdom)
    }
  }, [text])

  const Icon = copied ? Check : Copy

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={ariaLabel}
      title={copied ? '已复制' : ariaLabel}
      tabIndex={-1}
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground',
        copied && 'text-emerald-500',
        className,
      )}
      data-testid={testId}
    >
      <Icon className="h-2.5 w-2.5" />
    </button>
  )
})

export default CopyButton
