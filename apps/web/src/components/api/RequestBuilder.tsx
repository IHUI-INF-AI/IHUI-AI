'use client'

import * as React from 'react'
import { Play, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface RequestBuilderProps {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path?: string
  headers?: Record<string, string>
  body?: string
  loading?: boolean
  onMethodChange?: (m: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH') => void
  onPathChange?: (p: string) => void
  onHeadersChange?: (h: Record<string, string>) => void
  onBodyChange?: (b: string) => void
  onSend?: () => void
  className?: string
}

const METHODS: Array<RequestBuilderProps['method']> = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export default function RequestBuilder({
  method = 'GET',
  path = '/v1/',
  headers = {},
  body = '',
  loading = false,
  onMethodChange,
  onPathChange,
  onHeadersChange,
  onBodyChange,
  onSend,
  className,
}: RequestBuilderProps): React.JSX.Element {
  const [headerText, setHeaderText] = React.useState(() => JSON.stringify(headers, null, 2))
  React.useEffect(() => {
    try {
      setHeaderText(JSON.stringify(headers, null, 2))
    } catch {
      // ignore
    }
  }, [headers])

  const handleHeaderChange = (v: string) => {
    setHeaderText(v)
    try {
      const parsed = JSON.parse(v)
      onHeadersChange?.(parsed)
    } catch {
      // 解析失败时不回调，保留输入
    }
  }

  return (
    <div className={cn('rounded-xl border bg-card shadow', className)}>
      <div className="flex items-center gap-2 border-b p-3">
        <select
          value={method}
          onChange={(e) =>
            onMethodChange?.(e.target.value as Exclude<RequestBuilderProps['method'], undefined>)
          }
          className="rounded-md border bg-background px-2 py-1.5 text-sm outline-none"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={path}
          onChange={(e) => onPathChange?.(e.target.value)}
          placeholder="/v1/..."
          className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 font-mono text-sm outline-none"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={loading}
          className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          发送
        </button>
      </div>
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
        <div className="border-b p-3 lg:border-b-0 lg:border-r">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Headers</div>
          <textarea
            value={headerText}
            onChange={(e) => handleHeaderChange(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-md border bg-background p-2 font-mono text-xs outline-none"
            spellCheck={false}
          />
        </div>
        <div className="p-3">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Body</div>
          <textarea
            value={body}
            onChange={(e) => onBodyChange?.(e.target.value)}
            rows={6}
            disabled={method === 'GET'}
            placeholder={method === 'GET' ? 'GET 请求无 body' : '{ }'}
            className="w-full resize-none rounded-md border bg-background p-2 font-mono text-xs outline-none disabled:opacity-60"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}
