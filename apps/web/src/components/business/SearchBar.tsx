'use client'

import * as React from 'react'
import { Search, X, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  placeholder?: string
  onSearch?: (value: string) => void
  suggestions?: string[]
  history?: string[]
  onHistoryClick?: (item: string) => void
  onClearHistory?: () => void
  className?: string
  autoFocus?: boolean
}

export function SearchBar({
  placeholder = '搜索...',
  onSearch,
  suggestions = [],
  history = [],
  onHistoryClick,
  onClearHistory,
  className,
  autoFocus = false,
}: SearchBarProps) {
  const [value, setValue] = React.useState('')
  const [focused, setFocused] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onSearch?.(value.trim())
      setFocused(false)
    }
  }

  const showDropdown = focused && (suggestions.length > 0 || (history.length > 0 && !value))

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            autoFocus={autoFocus}
            placeholder={placeholder}
            className="h-10 w-full rounded-full border border-input bg-background pl-9 pr-9 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {value && (
            <button
              type="button"
              onClick={() => setValue('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {!value && history.length > 0 && (
            <div className="mb-1">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs text-muted-foreground">搜索历史</span>
                {onClearHistory && (
                  <button onClick={onClearHistory} className="text-xs text-muted-foreground hover:text-foreground">
                    清除
                  </button>
                )}
              </div>
              {history.map((item, i) => (
                <button
                  key={i}
                  onClick={() => { onHistoryClick?.(item); setValue(item); setFocused(false) }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {item}
                </button>
              ))}
            </div>
          )}
          {value && suggestions.length > 0 && (
            <div>
              {suggestions
                .filter((s) => s.toLowerCase().includes(value.toLowerCase()))
                .slice(0, 8)
                .map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setValue(s); onSearch?.(s); setFocused(false) }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Search className="h-3 w-3 text-muted-foreground" />
                    {s}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
