'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import type * as RemarkGfm from 'remark-gfm'
import SyntaxHighlighter from '@/components/media/SyntaxHighlighter'
import { isMermaidLanguage } from '@/lib/markdown-mermaid-code'
import { cn } from '@/lib/utils'

const ReactMarkdown = dynamic(() => import('react-markdown'), {
  ssr: false,
  loading: () => <div className="animate-pulse text-sm text-muted-foreground">…</div>,
})

// MermaidDiagram 仅在客户端加载,不影响首屏 bundle
const MermaidDiagram = dynamic(() => import('@/components/media/MermaidDiagram'), {
  ssr: false,
  loading: () => <div className="animate-pulse text-xs text-muted-foreground">…</div>,
})

interface MarkdownViewerProps {
  content: string
  className?: string
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const [remarkGfm, setRemarkGfm] = React.useState<typeof RemarkGfm.default | null>(null)
  // P2 中期增强:同时加载 dark/light 两份主题,运行时按当前主题切换
  const [styles, setStyles] = React.useState<{
    oneDark: Record<string, React.CSSProperties>
    oneLight: Record<string, React.CSSProperties>
  } | null>(null)
  const { resolvedTheme } = useTheme()

  React.useEffect(() => {
    let active = true
    Promise.all([
      import('remark-gfm'),
      import('react-syntax-highlighter/dist/esm/styles/prism'),
    ]).then(([gfm, prismStyles]) => {
      if (!active) return
      setRemarkGfm(gfm.default)
      setStyles({
        oneDark: prismStyles.oneDark as Record<string, React.CSSProperties>,
        oneLight: prismStyles.oneLight as Record<string, React.CSSProperties>,
      })
    })
    return () => {
      active = false
    }
  }, [])

  const syntaxStyle =
    resolvedTheme === 'dark' ? styles?.oneDark : (styles?.oneLight ?? styles?.oneDark)

  return (
    <div className={cn('prose prose-sm max-w-none dark:prose-invert', className)}>
      <ReactMarkdown
        remarkPlugins={remarkGfm ? [remarkGfm] : []}
        components={{
          code({ node: _node, className: cls, children, ...props }) {
            const match = /language-(\w+)/.exec(cls || '')
            const inline = !match && !String(children).includes('\n')
            if (inline) {
              return (
                <code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...props}>
                  {children}
                </code>
              )
            }
            // mermaid 块交给 MermaidDiagram 渲染,不走 Prism
            if (isMermaidLanguage(cls)) {
              return <MermaidDiagram code={String(children).replace(/\n$/, '')} />
            }
            return (
              <SyntaxHighlighter
                language={match ? match[1] : 'text'}
                style={syntaxStyle}
                PreTag="div"
                customStyle={{ borderRadius: '0.5rem', fontSize: '0.875rem' }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            )
          },
          a({ children, ...props }) {
            return (
              <a {...props} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
