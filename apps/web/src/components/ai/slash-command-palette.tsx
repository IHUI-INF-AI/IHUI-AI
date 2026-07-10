'use client'

import * as React from 'react'
import { Dialog, DialogContent, Input } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Command {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
}

interface SlashCommandPaletteProps {
  commands: Command[]
  onSelect: (id: string) => void
  open: boolean
  onClose: () => void
}

export function SlashCommandPalette({ commands, onSelect, open, onClose }: SlashCommandPaletteProps) {
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false),
    )
  }, [commands, query])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [filtered.length])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % Math.max(filtered.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[activeIndex]
      if (cmd) {
        onSelect(cmd.id)
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="top-[20%] max-w-md translate-y-0 gap-0 overflow-hidden p-0">
        <div className="border-b p-3">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索命令..."
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">无匹配命令</p>
          ) : (
            filtered.map((cmd, idx) => (
              <button
                key={cmd.id}
                type="button"
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  onSelect(cmd.id)
                  onClose()
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                  idx === activeIndex ? 'bg-accent text-accent-foreground' : 'text-foreground',
                )}
              >
                {cmd.icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center">{cmd.icon}</span>}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{cmd.label}</span>
                  {cmd.description && (
                    <span className="truncate text-xs text-muted-foreground">{cmd.description}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SlashCommandPalette
