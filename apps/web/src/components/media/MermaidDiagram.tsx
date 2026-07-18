'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface MermaidDiagramProps {
  code: string
  className?: string
}

/**
 * Mermaid 渲染错误边界。
 * 单次渲染失败不会冒泡到外层页面,保证整页可用。
 */
class MermaidErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  render(): React.ReactNode {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

/**
 * Mermaid 图表渲染组件(客户端 only)。
 *
 * - mermaid 通过 dynamic import 加载,不影响首屏 bundle
 * - 主题跟随 next-themes 的 resolvedTheme,自动切换 dark / default
 * - 渲染失败时显示错误降级块 + 源码,不影响外层页面
 * - SVG 容器 overflow-x-auto,长图表可横向滚动
 */
function MermaidDiagramInner({ code, className }: MermaidDiagramProps) {
  const { resolvedTheme } = useTheme()
  const [svg, setSvg] = React.useState<string | null>(null)
  const [error, setError] = React.useState<Error | null>(null)

  // 用 useId 生成唯一 id,避免多实例冲突
  const rawId = React.useId()
  const id = `mermaid-${rawId.replace(/:/g, '')}`

  React.useEffect(() => {
    let cancelled = false

    async function run(): Promise<void> {
      try {
        // dynamic import,避免 SSR 报错 & 影响首屏 bundle size
        const mermaidModule = await import('mermaid')
        const mermaid = mermaidModule.default
        await mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose',
        })
        const result = await mermaid.render(id, code)
        if (cancelled) return
        setSvg(result.svg)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setSvg(null)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [code, resolvedTheme, id])

  // 渲染失败,显示错误降级块 + 源码
  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
        <p className="text-destructive">{error.message}</p>
        <pre className="mt-2 text-xs text-muted-foreground">{code}</pre>
      </div>
    )
  }

  // 渲染中占位
  if (svg === null) {
    return <div className="animate-pulse text-xs text-muted-foreground">渲染中…</div>
  }

  // 渲染成功,展示 SVG(横向滚动以适配长图表)
  return (
    <div className={cn('overflow-x-auto', className)}>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}

/**
 * 导出的 Mermaid 图表组件,内部已用 ErrorBoundary 包裹。
 */
export function MermaidDiagram(props: MermaidDiagramProps): React.ReactElement {
  return (
    <MermaidErrorBoundary
      fallback={
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
          <p className="text-destructive">Mermaid 渲染失败</p>
          <pre className="mt-2 text-xs text-muted-foreground">{props.code}</pre>
        </div>
      }
    >
      <MermaidDiagramInner {...props} />
    </MermaidErrorBoundary>
  )
}

export default MermaidDiagram
