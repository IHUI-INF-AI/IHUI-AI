'use client'

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ApiMethod {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  group?: string
}

export interface ApiMethodSearchProps {
  methods?: ApiMethod[]
  onSelect?: (m: ApiMethod) => void
  placeholder?: string
  className?: string
}

const METHOD_COLOR: Record<ApiMethod['method'], string> = {
  GET: 'bg-emerald-500/10 text-emerald-600',
  POST: 'bg-blue-500/10 text-blue-600',
  PUT: 'bg-amber-500/10 text-amber-600',
  DELETE: 'bg-destructive/10 text-destructive',
  PATCH: 'bg-purple-500/10 text-purple-600',
}

export default function ApiMethodSearch({
  methods = [],
  onSelect,
  placeholder = '搜索 API 方法...',
  className,
}: ApiMethodSearchProps): React.JSX.Element {
  const [q, setQ] = React.useState('')
  const [focus, setFocus] = React.useState(false)
  const boxRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocus(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = q
    ? methods.filter(
        (m) =>
          m.name.toLowerCase().includes(q.toLowerCase()) ||
          m.path.toLowerCase().includes(q.toLowerCase()) ||
          m.group?.toLowerCase().includes(q.toLowerCase()),
      )
    : methods

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {focus && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover shadow-lg">
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect?.(m)
                  setFocus(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-medium',
                    METHOD_COLOR[m.method],
                  )}
                >
                  {m.method}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                {m.group && (
                  <span className="shrink-0 text-xs text-muted-foreground">{m.group}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
