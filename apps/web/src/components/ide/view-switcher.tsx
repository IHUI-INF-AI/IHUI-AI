// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import type { IDETabType } from '@ihui/types'
import {
  ChevronDown,
  FileText,
  Terminal,
  Globe,
  GitCompare,
  Palette,
  Bot,
  Settings,
  Plug,
  Plus,
} from 'lucide-react'
import { SearchInput } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
// 2026-09-15 治理:浮层定位/portal/关闭逻辑统一收敛到 PortalPanel
import { PortalPanel } from '@/components/feedback/portal-panel'

type OptionItem = {
  id: IDETabType
  icon: typeof FileText
  labelKey?: string
  label?: string
  // 可选:并非每个视图都有 chord;声明了就必须真有处理器(见 scripts/check-declared-shortcuts.mjs)
  shortcut?: string
}
type OptionGroup = { titleKey: string; items: OptionItem[] }

const TAB_GROUPS: OptionGroup[] = [
  {
    titleKey: 'viewSwitcher.groupView',
    items: [
      { id: 'document', icon: FileText, labelKey: 'topBar.document', shortcut: 'Ctrl+1' },
      { id: 'browser', icon: Globe, labelKey: 'topBar.browser', shortcut: 'Ctrl+2' },
      { id: 'figma', icon: Palette, label: 'Figma', shortcut: 'Ctrl+3' },
    ],
  },
  {
    titleKey: 'viewSwitcher.groupTools',
    items: [
      { id: 'terminal', icon: Terminal, labelKey: 'topBar.terminal', shortcut: 'Ctrl+`' },
      { id: 'code-changes', icon: GitCompare, labelKey: 'topBar.codeChanges', shortcut: 'Ctrl+4' },
      { id: 'agent', icon: Bot, labelKey: 'topBar.agent', shortcut: 'Ctrl+5' },
      { id: 'mcp', icon: Plug, label: 'MCP' },
    ],
  },
  {
    titleKey: 'viewSwitcher.groupSettings',
    items: [{ id: 'settings', icon: Settings, labelKey: 'topBar.settings', shortcut: 'Ctrl+,' }],
  },
]

export function ViewSwitcher() {
  const t = useTranslations('ide')
  const { activeTopTab, setActiveTopTab } = useIDEWorkspace()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const ref = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const itemLabel = (item: OptionItem) => (item.labelKey ? t(item.labelKey) : (item.label ?? ''))

  React.useEffect(() => {
    if (!open) return
    setQuery('')
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  const filteredGroups = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return TAB_GROUPS
    return TAB_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => itemLabel(i).toLowerCase().includes(q) || i.id.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅依赖 query 变化时重新过滤,其他依赖通过闭包捕获
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
      <PortalPanel
        open={open}
        anchorRef={ref}
        onClose={() => setOpen(false)}
        side="bottom"
        align="start"
        gap={4}
        className="w-64 rounded-md border border-border bg-popover p-1 shadow-md"
      >
        <div className="px-1 pb-1 pt-0.5">
          <SearchInput
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('viewSwitcher.searchPlaceholder')}
            size="sm"
            wrapperClassName="w-full"
          />
        </div>
        {filteredGroups.length === 0 ? (
          <div className="px-3 py-3 text-center text-xs text-muted-foreground">
            {t('viewSwitcher.noMatch')}
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.titleKey} className="px-1 pb-1 pt-1">
              <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t(group.titleKey)}
              </div>
              {group.items.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setActiveTopTab(opt.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors',
                    activeTopTab === opt.id
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <opt.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 min-w-0 text-left">{itemLabel(opt)}</span>
                  {opt.shortcut ? (
                    <span className="text-[10px] text-muted-foreground/80">{opt.shortcut}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ))
        )}
      </PortalPanel>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
