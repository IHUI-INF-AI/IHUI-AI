'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import type * as RemarkGfm from 'remark-gfm'
import SyntaxHighlighter from '@/components/media/SyntaxHighlighter'
import { cn } from '@/lib/utils'

const ReactMarkdown = dynamic(() => import('react-markdown'), {
  ssr: false,
  loading: () => <div className="animate-pulse text-sm text-muted-foreground">…</div>,
})

interface MarkdownViewerProps {
  content: string
  className?: string
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const [remarkGfm, setRemarkGfm] = React.useState<typeof RemarkGfm.default | null>(null)
  const [oneDark, setOneDark] = React.useState<unknown>(null)

  React.useEffect(() => {
    let active = true
    Promise.all([
      import('remark-gfm'),
      import('react-syntax-highlighter/dist/esm/styles/prism'),
    ]).then(([gfm, styles]) => {
      if (!active) return
      setRemarkGfm(gfm.default)
      setOneDark(styles.oneDark)
    })
    return () => {
      active = false
    }
  }, [])

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
            return (
              <SyntaxHighlighter
                language={match ? match[1] : 'text'}
                style={(oneDark as Record<string, React.CSSProperties>) ?? undefined}
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
