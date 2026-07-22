'use client'
import * as React from 'react'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import type { IDETabType } from '@ihui/types'
import { ChevronDown, FileText, Terminal, Globe, GitCompare, Figma, Bot, Settings, Plug, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type OptionItem = { id: IDETabType; icon: typeof FileText; label: string; shortcut: string }
type OptionGroup = { title: string; items: OptionItem[] }

const TAB_GROUPS: OptionGroup[] = [
  {
    title: '视图',
    items: [
      { id: 'document', icon: FileText, label: '文档', shortcut: 'Ctrl+1' },
      { id: 'browser', icon: Globe, label: '浏览器', shortcut: 'Ctrl+2' },
      { id: 'figma', icon: Figma, label: 'Figma', shortcut: 'Ctrl+3' },
    ],
  },
  {
    title: '工具',
    items: [
      { id: 'terminal', icon: Terminal, label: '终端', shortcut: 'Ctrl+`' },
      { id: 'code-changes', icon: GitCompare, label: '代码变更', shortcut: 'Ctrl+4' },
      { id: 'agent', icon: Bot, label: '智能体', shortcut: 'Ctrl+5' },
      { id: 'mcp', icon: Plug, label: 'MCP', shortcut: 'Ctrl+6' },
    ],
  },
  {
    title: '设置',
    items: [
      { id: 'settings', icon: Settings, label: '设置', shortcut: 'Ctrl+,' },
    ],
  },
]

export function ViewSwitcher() {
  const { activeTopTab, setActiveTopTab } = useIDEWorkspace()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const ref = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  React.useEffect(() => {
    if (!open) return
    setQuery('')
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  const filteredGroups = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return TAB_GROUPS
    return TAB_GROUPS
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) => i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0)
  }, [query])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-0.5 rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover p-1 shadow-md">
          <div className="px-1 pb-1 pt-0.5">
            <div className="flex items-center gap-1.5 rounded-sm bg-muted/50 px-2 py-1">
              <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索视图..."
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </div>
          {filteredGroups.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-muted-foreground">无匹配项</div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.title} className="px-1 pb-1 pt-1">
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </div>
                {group.items.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setActiveTopTab(opt.id); setOpen(false) }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors',
                      activeTopTab === opt.id
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <opt.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 text-left">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground/80">{opt.shortcut}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
