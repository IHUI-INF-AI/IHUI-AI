'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import { Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { isMermaidLanguage } from '@/lib/markdown-mermaid-code'

// MermaidDiagram 仅在客户端加载,不影响首屏 bundle
const MermaidDiagram = dynamic(() => import('@/components/media/MermaidDiagram'), {
  ssr: false,
  loading: () => <div className="animate-pulse text-xs text-muted-foreground">…</div>,
})

export interface McpResource {
  uri: string
  name: string
  mimeType?: string
  content?: string
}

export interface McpResourceViewerProps {
  resource: McpResource
}

export function McpResourceViewer({ resource }: McpResourceViewerProps) {
  const t = useTranslations('mcp')
  const { uri, name, mimeType, content } = resource
  const type = (mimeType ?? '').toLowerCase()

  const isImage = type.startsWith('image/')
  const isJson = type.includes('json') || uri.endsWith('.json')
  const isMarkdown = type.includes('markdown') || uri.endsWith('.md')
  const isText = type.startsWith('text/') || type === ''

  let jsonData: unknown = undefined
  let jsonValid = false
  if (isJson && content) {
    try {
      jsonData = JSON.parse(content)
      jsonValid = true
    } catch {
      jsonValid = false
    }
  }

  const downloadHref = content
    ? content.startsWith('http') || content.startsWith('data:')
      ? content
      : `data:${mimeType || 'application/octet-stream'};base64,${content}`
    : undefined

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <span className="text-xs text-muted-foreground">{t('resourceUri')}:</span>
        <span className="break-all font-mono text-xs">{uri}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs font-medium">{name}</span>
        {mimeType && (
          <>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{mimeType}</span>
          </>
        )}
      </div>

      {isImage && content ? (
        <div className="flex justify-center rounded-lg border p-4">
          <Image
            src={content}
            alt={name}
            width={800}
            height={600}
            unoptimized
            className="h-auto w-auto max-h-[400px] object-contain"
          />
        </div>
      ) : isJson && jsonValid ? (
        <pre className="max-h-[400px] overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
          {JSON.stringify(jsonData, null, 2)}
        </pre>
      ) : isMarkdown && content ? (
        <div className="max-h-[400px] overflow-auto rounded-lg border bg-muted/30 p-3 text-sm">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className: cls, children, ...props }) {
                const match = /language-(\w+)/.exec(cls || '')
                const inline = !match && !String(children).includes('\n')
                if (inline) {
                  return (
                    <code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...props}>
                      {children}
                    </code>
                  )
                }
                // mermaid 块交给 MermaidDiagram 渲染
                if (isMermaidLanguage(cls)) {
                  return <MermaidDiagram code={String(children).replace(/\n$/, '')} />
                }
                return (
                  <code className={cls} {...props}>
                    {children}
                  </code>
                )
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      ) : isText && content ? (
        <pre className="max-h-[400px] overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
          {content}
        </pre>
      ) : downloadHref ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border p-8">
          <Download className="h-8 w-8 text-muted-foreground" />
          <a href={downloadHref} download={name} className="text-sm text-primary hover:underline">
            {t('download')} {name}
          </a>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('noContent')}
        </div>
      )}
    </div>
  )
}
