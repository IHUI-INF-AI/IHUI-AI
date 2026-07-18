'use client'

import * as React from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ResponseViewerProps {
  status?: number
  duration?: number
  body?: unknown
  raw?: string
  className?: string
}

function statusColor(code?: number) {
  if (!code) return 'text-muted-foreground'
  if (code < 300) return 'text-emerald-500'
  if (code < 400) return 'text-amber-500'
  return 'text-destructive'
}

export default function ResponseViewer({
  status,
  duration,
  body,
  raw,
  className,
}: ResponseViewerProps): React.JSX.Element {
  const [copied, setCopied] = React.useState(false)
  const text = React.useMemo(() => {
    if (raw) return raw
    if (body === null || body === undefined) return ''
    if (typeof body === 'string') return body
    try {
      return JSON.stringify(body, null, 2)
    } catch {
      return String(body)
    }
  }, [body, raw])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div className={cn('rounded-xl border bg-card shadow', className)}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-3 text-xs">
          <span className={cn('font-medium', statusColor(status))}>
            {status ? `HTTP ${status}` : '未发送'}
          </span>
          {duration !== undefined && <span className="text-muted-foreground">{duration} ms</span>}
        </div>
        <button
          type="button"
          onClick={copy}
          disabled={!text}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label="复制响应"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-3 text-xs">
        <code>{text || '// 暂无响应'}</code>
      </pre>
    </div>
  )
}
