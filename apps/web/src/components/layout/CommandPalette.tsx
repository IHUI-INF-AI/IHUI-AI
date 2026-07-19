'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Search, MessageSquare, Sparkles, Globe, User, Settings } from 'lucide-react'
import { Dialog, DialogContent } from '@ihui/ui'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  keywords?: string[]
}

const COMMANDS: CommandItem[] = [
  {
    id: 'chat',
    label: 'AI 对话',
    description: '打开 AI 聊天',
    icon: MessageSquare,
    path: '/chat',
    keywords: ['chat', 'ai', '对话'],
  },
  {
    id: 'drama',
    label: '短剧编辑器',
    description: 'AI 辅助剧本创作',
    icon: Sparkles,
    path: '/drama',
    keywords: ['drama', '短剧', '剧本'],
  },
  {
    id: 'search',
    label: '高级搜索',
    description: '搜索用户/项目/文件',
    icon: Search,
    path: '/search',
    keywords: ['search', '搜索', '查找'],
  },
  {
    id: 'ai-world',
    label: 'AI 世界',
    description: '浏览 AI 应用',
    icon: Globe,
    path: '/ai-world',
    keywords: ['ai-world', '世界', '应用'],
  },
  {
    id: 'profile',
    label: '个人中心',
    description: '账户设置与资料',
    icon: User,
    path: '/user-center',
    keywords: ['profile', '个人', '设置'],
  },
  {
    id: 'settings',
    label: '系统设置',
    description: '偏好与配置',
    icon: Settings,
    path: '/settings',
    keywords: ['settings', '设置', '配置'],
  },
]

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMMANDS
    return COMMANDS.filter((c) => {
      const text = `${c.label} ${c.description ?? ''} ${c.keywords?.join(' ') ?? ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [query])

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
            placeholder="搜索页面或功能..."
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
            <div className="py-8 text-center text-sm text-muted-foreground">未找到匹配的命令</div>
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
                    <div className="truncate text-sm font-medium">{item.label}</div>
                    {item.description && (
                      <div className="truncate text-xs text-muted-foreground">
                        {item.description}
                      </div>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
        <div className="flex items-center justify-between bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <span>↑↓ 导航 · Enter 选择</span>
          <span>{filtered.length} 个结果</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
