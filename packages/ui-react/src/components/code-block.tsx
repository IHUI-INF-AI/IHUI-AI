'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '../lib/utils.js'

/**
 * 轻量级代码块组件:纯文本 + 复制按钮 + 流式标记 + 错误降级。
 *
 * 主题感知:使用 Tailwind 设计 token(`bg-muted` / `text-foreground` 等),
 * 由调用方应用的全局主题(含 dark 模式)自动适配,跨端通用,不绑定任何框架。
 *
 * 语法高亮:本组件不内置语法高亮 —— 避免引入 react-syntax-highlighter 这类重依赖,
 * 因 packages/ui 需被 desktop / extension / mobile-rn / miniapp-taro 等 8 端复用。
 * 若需语法高亮,调用方可:
 *   1. 自行用高亮组件包裹,再传入 children 渲染;
 *   2. 在 web 端直接使用 apps/web 的 ThemedCodeBlock(markdown-stream.tsx)。
 */
export interface CodeBlockProps {
  code: string
  language?: string
  isStreaming?: boolean
  showCopy?: boolean
  className?: string
}

function useCopy() {
  const [copied, setCopied] = React.useState(false)
  const copy = React.useCallback((text: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }, [])
  return { copied, copy }
}

class CodeBlockErrorBoundary extends React.PureComponent<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch() {
    // 静默降级到 fallback
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

const CodeBlockImpl = ({
  code,
  language,
  isStreaming,
  showCopy = true,
  className,
}: CodeBlockProps): React.ReactElement => {
  const { copied, copy } = useCopy()
  const lang = (language ?? '').trim().toLowerCase()

  const copyButton = showCopy ? (
    <button
      type="button"
      onClick={() => copy(code)}
      aria-label={copied ? '已复制' : '复制代码'}
      className={cn(
        'absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md',
        'text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-foreground',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  ) : null

  const preClassName = cn(
    'relative my-2 overflow-x-auto rounded-lg p-3 text-sm',
    'bg-muted text-foreground',
    isStreaming && 'opacity-60',
    className,
  )

  const content = (
    <pre className={preClassName}>
      {copyButton}
      <code className={cn('font-mono', lang && `language-${lang}`)}>{code}</code>
    </pre>
  )

  const fallback = (
    <pre className={preClassName}>
      <code className="font-mono">{code}</code>
    </pre>
  )

  return <CodeBlockErrorBoundary fallback={fallback}>{content}</CodeBlockErrorBoundary>
}

export const CodeBlock = React.memo(CodeBlockImpl)
CodeBlock.displayName = 'CodeBlock'
