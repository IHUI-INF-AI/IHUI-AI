'use client'

import * as React from 'react'
import { Search, FileText } from 'lucide-react'

import { Input } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface MentionFile {
  id: string
  name: string
  path: string
}

interface FileMentionPopoverProps {
  files: MentionFile[]
  open: boolean
  onSelect: (file: MentionFile) => void
  onClose: () => void
}

export function FileMentionPopover({ files, open, onSelect, onClose }: FileMentionPopoverProps) {
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return files
    return files.filter(
      (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q),
    )
  }, [files, query])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const current = filtered[activeIndex]
      if (current) {
        onSelect(current)
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-80 overflow-hidden rounded-lg border bg-popover shadow-lg">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索文件..."
          className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <ul ref={listRef} className="max-h-60 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">无匹配文件</li>
        ) : (
          filtered.map((file, idx) => (
            <li key={file.id}>
              <button
                type="button"
                data-idx={idx}
                onClick={() => {
                  onSelect(file)
                  onClose()
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  idx === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                )}
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{file.path}</p>
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

export default FileMentionPopover
