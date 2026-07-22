'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search, MessageSquare, Sparkles, Globe, User, Settings } from 'lucide-react'
import { Dialog, DialogContent } from '@ihui/ui'

interface CommandItem {
  id: string
  icon: React.ComponentType<{ className?: string }>
  path: string
}

const COMMANDS: CommandItem[] = [
  { id: 'chat', icon: MessageSquare, path: '/chat' },
  { id: 'drama', icon: Sparkles, path: '/drama' },
  { id: 'search', icon: Search, path: '/search' },
  { id: 'ai-world', icon: Globe, path: '/ai-world' },
  { id: 'profile', icon: User, path: '/admin/user-center' },
  { id: 'settings', icon: Settings, path: '/settings' },
]

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const router = useRouter()
  const t = useTranslations('commandPalette')
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMMANDS
    return COMMANDS.filter((c) => {
      const keywords = t.raw(`commands.${c.id}.keywords`) as string[]
      const text = `${t(`commands.${c.id}.label`)} ${t(`commands.${c.id}.description`)} ${keywords.join(' ')}`.toLowerCase()
      return text.includes(q)
    })
  }, [query, t])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  function execute(item: CommandItem) {
    router.push(item.path)
    onOpenChange(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[activeIndex]
      if (item) execute(item)
    }
  }

  React.useEffect(() => {
    const activeEl = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`)
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <div className="flex items-center gap-2 bg-muted/30 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('noResults')}</div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  data-idx={idx}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    idx === activeIndex ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => execute(item)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t(`commands.${item.id}.label`)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t(`commands.${item.id}.description`)}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
        <div className="flex items-center justify-between bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <span>{t('keyboardHint')}</span>
          <span>{t('resultCount', { count: filtered.length })}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
