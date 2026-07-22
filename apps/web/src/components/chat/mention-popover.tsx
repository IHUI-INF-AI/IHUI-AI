'use client'

import * as React from 'react'
import {
  Search,
  File,
  Table,
  Code,
  Folder,
  Globe,
  X,
  Loader2,
  type LucideIcon,
} from 'lucide-react'

import { Input } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { useSearchMentions } from '@/hooks/use-context-mention'
import { useContextMentionStore } from '@/stores/context-mention'
import type { ContextMention, MentionType } from '@ihui/types'
import { DatabaseMentionList } from './database-mention-list'

/** 提及类型 tab 配置 */
const MENTION_TABS: Array<{ type: MentionType; label: string; icon: LucideIcon }> = [
  { type: 'file', label: '文件', icon: File },
  { type: 'database', label: '数据库', icon: Table },
  { type: 'symbol', label: '符号', icon: Code },
  { type: 'folder', label: '文件夹', icon: Folder },
  { type: 'web', label: '网络', icon: Globe },
]

/** 类型 → 图标映射(列表项 + chips 用) */
const TYPE_ICON: Record<MentionType, LucideIcon> = {
  file: File,
  database: Table,
  symbol: Code,
  folder: Folder,
  web: Globe,
}

interface MentionPopoverProps {
  open: boolean
  onSelect: (mention: ContextMention) => void
  onClose: () => void
  /** 工作区路径(folder 扫描需要) */
  workspacePath?: string
}

/**
 * 多类型 Mention 弹窗(替代 FileMentionPopover)。
 *
 * - 顶部 tab 切换:文件 / 数据库 / 符号 / 文件夹 / 网络(默认文件)
 * - 输入框搜索 + 列表显示(label + detail)
 * - 选中后插入 insertText 到 message-input,并把 ContextMention 加入 store
 * - 键盘导航:ArrowUp/Down/Enter/Escape
 * - database tab 委托 DatabaseMentionList(支持展开表 schema)
 *
 * 紧凑:`w-64 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-md`
 */
export function MentionPopover({ open, onSelect, onClose, workspacePath }: MentionPopoverProps) {
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [itemCount, setItemCount] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const activeType = useContextMentionStore((s) => s.activeType)
  const setActiveType = useContextMentionStore((s) => s.setActiveType)

  // database tab 由 DatabaseMentionList 自行管理数据,其他 tab 用 useSearchMentions
  const isDatabase = activeType === 'database'
  const { data, isLoading } = useSearchMentions(
    query,
    activeType,
    workspacePath,
    open && !isDatabase,
  )
  const mentions = isDatabase ? [] : (data?.mentions ?? [])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // 切换 tab 或 query 时重置 activeIndex
  React.useEffect(() => {
    setActiveIndex(0)
  }, [activeType, query])

  // 非 database tab 的 itemCount 跟随 mentions
  React.useEffect(() => {
    if (!isDatabase) setItemCount(mentions.length)
  }, [mentions.length, isDatabase])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(itemCount - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (isDatabase) return // database tab 由 DatabaseMentionList 处理选中
      const current = mentions[activeIndex]
      if (current) {
        onSelect(current)
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="absolute bottom-full left-0 z-popover mb-2 w-64 max-h-72 overflow-hidden rounded-md border border-border bg-popover shadow-md">
      {/* Tab 切换条 */}
      <div className="flex items-center gap-0.5 bg-muted/40 px-1 py-1">
        {MENTION_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeType === tab.type
          return (
            <button
              key={tab.type}
              type="button"
              onClick={() => {
                setActiveType(tab.type)
                setQuery('')
              }}
              aria-label={tab.label}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
                // 2026-07-19 中文 + 图标垂直对齐:文字 span 视觉居中
                '[&>span]:translate-y-[var(--text-vcenter-offset)]',
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
      {/* 搜索框 */}
      <div className="flex items-center gap-2 bg-muted/40 px-2 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`搜索${MENTION_TABS.find((t) => t.type === activeType)?.label ?? ''}...`}
          className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
        />
      </div>
      {/* 列表区域 */}
      <div className="overflow-y-auto">
        {isDatabase ? (
          <DatabaseMentionList
            query={query}
            onSelect={(m) => {
              onSelect(m)
              onClose()
            }}
            activeIndex={activeIndex}
            onItemCountChange={setItemCount}
          />
        ) : isLoading ? (
          <div className="flex items-center justify-center px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            检索中...
          </div>
        ) : mentions.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {query ? '无匹配结果' : '输入关键词搜索'}
          </div>
        ) : (
          <MentionList
            mentions={mentions}
            activeIndex={activeIndex}
            onSelect={(m) => {
              onSelect(m)
              onClose()
            }}
          />
        )}
      </div>
    </div>
  )
}

/** 通用列表(file/symbol/folder/web 共用) */
function MentionList({
  mentions,
  activeIndex,
  onSelect,
}: {
  mentions: ContextMention[]
  activeIndex: number
  onSelect: (m: ContextMention) => void
}) {
  const listRef = React.useRef<HTMLUListElement>(null)
  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])
  return (
    <ul ref={listRef} className="max-h-48 overflow-y-auto p-1">
      {mentions.map((m, idx) => {
        const Icon = TYPE_ICON[m.type] ?? File
        return (
          <li key={m.id}>
            <button
              type="button"
              data-idx={idx}
              onClick={() => onSelect(m)}
              onMouseEnter={() => {
                /* hover 由 activeIndex 管理,此处不直接 setActiveIndex 避免与键盘冲突 */
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                idx === activeIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50',
              )}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{m.label}</p>
                {m.detail && (
                  <p className="break-words text-xs text-muted-foreground">{m.detail}</p>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * 已选提及 chips 面板(显示在输入框上方)。
 *
 * 由主 agent 集成到 message-input.tsx 的输入框上方区域。
 * 每个 chip:类型图标 + label + x 删除按钮,删除时调 store.removeMention。
 */
export function MentionChips() {
  const mentions = useContextMentionStore((s) => s.mentions)
  const removeMention = useContextMentionStore((s) => s.removeMention)
  if (mentions.length === 0) return null
  return (
    <div className="mb-2 flex flex-wrap gap-1">
      {mentions.map((m) => {
        const Icon = TYPE_ICON[m.type] ?? File
        return (
          <span
            key={m.id}
            className="inline-flex h-6 items-center gap-1 rounded bg-muted px-2 text-xs text-muted-foreground"
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="max-w-[12rem] truncate">{m.label}</span>
            <button
              type="button"
              onClick={() => removeMention(m.id)}
              aria-label={`移除 ${m.label}`}
              className="ml-0.5 inline-flex shrink-0 items-center text-muted-foreground/70 hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}

export default MentionPopover
