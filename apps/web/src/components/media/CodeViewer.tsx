'use client'

import * as React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CodeViewerProps {
  code: string
  language?: string
  showLineNumbers?: boolean
  showCopyButton?: boolean
  className?: string
}

export function CodeViewer({
  code,
  language = 'text',
  showLineNumbers = false,
  showCopyButton = true,
  className,
}: CodeViewerProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className={cn('group relative overflow-hidden rounded-lg', className)}>
      {showCopyButton && (
        <button
          onClick={handleCopy}
          className="absolute right-2 top-2 z-10 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      )}
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers={showLineNumbers}
        customStyle={{ borderRadius: '0.5rem', fontSize: '0.875rem', margin: 0 }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
