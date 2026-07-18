'use client'

import * as React from 'react'
import SyntaxHighlighter from '@/components/media/SyntaxHighlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useClipboard } from '@/hooks/use-clipboard'

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
  const { copied, copy } = useClipboard()
  // P2 中期增强:按主题切换语法高亮样式(dark → oneDark,其他 → oneLight)
  const { resolvedTheme } = useTheme()
  const syntaxStyle = resolvedTheme === 'dark' ? oneDark : oneLight

  const handleCopy = () => {
    void copy(code)
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
        style={syntaxStyle}
        showLineNumbers={showLineNumbers}
        customStyle={{ borderRadius: '0.5rem', fontSize: '0.875rem', margin: 0 }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
