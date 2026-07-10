'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from '@/lib/utils'

interface MarkdownViewerProps {
  content: string
  className?: string
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  return (
    <div className={cn('prose prose-sm max-w-none dark:prose-invert', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
                style={oneDark}
                PreTag="div"
                customStyle={{ borderRadius: '0.5rem', fontSize: '0.875rem' }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            )
          },
          a({ children, ...props }) {
            return <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
