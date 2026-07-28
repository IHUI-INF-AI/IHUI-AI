'use client'

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { Popover } from '@/components/feedback'

/** 命令分组(2026-07-29 立,按重要性排序) */
export type SlashCommandCategory = 'goal' | 'mode' | 'permission' | 'template'

interface Command {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  /** 命令类型(2026-07-25 立):
   * - 'template'(默认):选命令后填充模板到 textarea
   * - 'action':选命令后执行动作(如切换模式),不填充 textarea */
  kind?: 'template' | 'action'
  /** 命令分组(2026-07-29 立,深度重构):goal=目标与循环 / mode=模式切换 / permission=权限管理 / template=内容模板 */
  category?: SlashCommandCategory
  /** 命令用法提示(2026-07-29 立),如 "/goal <目标条件>",显示在命令项右侧 mono 小字 */
  usage?: string
  /** 是否需要参数(2026-07-29 立):true 时点击后填充命令到 textarea 让用户继续输入,false 时直接执行 */
  hasArgs?: boolean
}

interface SlashCommandPaletteProps {
  commands: Command[]
  onSelect: (id: string) => void
  open: boolean
  /** 受控开关回调:点击 trigger / ESC / 选命令 / 点外部 都通过此回调同步外部 state */
  onOpenChange: (open: boolean) => void
  /** trigger 元素(斜杠按钮),弹层锚定到该元素上方 */
  children: React.ReactElement
  /** hover 时显示的轻量文字提示(可选,由 Popover 内部 Tooltip 渲染) */
  tooltip?: React.ReactNode
}

/** 分组元信息(2026-07-29 立,深度重构:命令分组提升可发现性)
 * - label:分组小标题(text-[10px] uppercase tracking-wider text-muted-foreground/60)
 * - icon:分组图标(小标题左侧)
 * - 顺序:goal(重点)→ mode → permission → template */
const CATEGORY_META: Record<SlashCommandCategory, { label: string; icon: React.ReactNode }> = {
  goal: {
    label: '目标与循环',
    icon: <span className="text-[10px]">🎯</span>,
  },
  mode: {
    label: '模式切换',
    icon: <span className="text-[10px]">⚡</span>,
  },
  permission: {
    label: '权限管理',
    icon: <span className="text-[10px]">🔐</span>,
  },
  template: {
    label: '内容模板',
    icon: <span className="text-[10px]">📝</span>,
  },
}

const CATEGORY_ORDER: SlashCommandCategory[] = ['goal', 'mode', 'permission', 'template']

/** 分组图标颜色(左侧 icon 着色,提升视觉层次) */
const CATEGORY_ICON_COLOR: Record<SlashCommandCategory, string> = {
  goal: 'text-primary',
  mode: 'text-blue-500 dark:text-blue-400',
  permission: 'text-amber-500 dark:text-amber-400',
  template: 'text-muted-foreground',
}

/**
 * 斜杠命令面板(2026-07-29 深度重构:三段式布局 + 分组 + 图标 + 视觉层次)。
 *
 * 设计目标(对标 Cursor / Claude Code / Codex 命令面板):
 * - 三段式布局:顶部搜索框(带 Search 图标 + clear)→ 中部分组命令列表 → 底部快捷键提示
 * - 命令分组:goal(目标与循环,置顶重点)→ mode(模式切换)→ permission(权限管理)→ template(内容模板)
 * - 每命令配 lucide 图标,按分组着色,提升视觉辨识度
 * - 视觉层次:label 粗体 + description 浅色小字 + usage mono 提示
 * - active 项:左侧 2px primary 高亮条 + bg-accent,键盘导航清晰可见
 * - footer 快捷键提示:↑↓ 选择 · Enter 确认 · ESC 关闭,带 kbd 样式
 *
 * 弹层用 Popover position="top" align="start" portal,锚定 trigger 按钮上方,
 * 无遮罩轻弹出,符合"按钮上方轻弹出"的视觉预期。
 */
export function SlashCommandPalette({
  commands,
  onSelect,
  open,
  onOpenChange,
  children,
  tooltip,
}: SlashCommandPaletteProps) {
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) || (c.description?.toLowerCase().includes(q) ?? false),
    )
  }, [commands, query])

  // 按 category 分组(保持 CATEGORY_ORDER 顺序)
  const grouped = React.useMemo(() => {
    const map = new Map<SlashCommandCategory, Command[]>()
    for (const cmd of filtered) {
      const cat = cmd.category ?? 'template'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(cmd)
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      items: map.get(c)!,
    }))
  }, [filtered])

  // 扁平化索引(用于键盘导航 activeIndex)
  const flatItems = React.useMemo(() => grouped.flatMap((g) => g.items), [grouped])

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

  // active 项滚动到可视区(键盘导航时不被遮挡)
  React.useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % Math.max(flatItems.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + flatItems.length) % Math.max(flatItems.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = flatItems[activeIndex]
      if (cmd) {
        onSelect(cmd.id)
        onOpenChange(false)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onOpenChange(false)
    }
  }

  let runningIdx = -1 // 扁平索引累加器(跨分组连续编号)

  const content = (
    <div className="flex flex-col">
      {/* 顶部搜索框(2026-07-29 立,带 Search 图标 + clear 按钮) */}
      <div className="relative flex items-center bg-muted/30 px-3 py-2">
        <Search className="pointer-events-none mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索命令..."
          className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="清空搜索"
            className="ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {/* 中部分组命令列表(2026-07-29 立,按 category 分组 + 小标题) */}
      <div ref={listRef} className="thin-scroll max-h-80 overflow-y-auto p-1.5">
        {flatItems.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <p className="text-sm text-muted-foreground">无匹配命令</p>
            <p className="text-[10px] text-muted-foreground/60">尝试清空搜索或输入命令名</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.category} className="mb-1 last:mb-0">
              {/* 分组小标题 */}
              <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
                {CATEGORY_META[group.category].icon}
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {CATEGORY_META[group.category].label}
                </span>
              </div>
              {/* 分组命令项 */}
              {group.items.map((cmd) => {
                runningIdx += 1
                const idx = runningIdx
                const isActive = idx === activeIndex
                const iconColor = CATEGORY_ICON_COLOR[cmd.category ?? 'template']
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    data-cmd-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      onSelect(cmd.id)
                      onOpenChange(false)
                    }}
                    className={cn(
                      'relative flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/50',
                    )}
                  >
                    {/* active 项左侧高亮条(2026-07-29 立,2px primary 色条) */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-sm bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    {/* 命令图标(按分组着色) */}
                    {cmd.icon && (
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center',
                          iconColor,
                        )}
                      >
                        {cmd.icon}
                      </span>
                    )}
                    {/* 命令文本(label + description + usage 三层) */}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="break-words text-sm font-medium leading-tight">
                          {cmd.label}
                        </span>
                        {cmd.hasArgs && cmd.usage && (
                          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/60">
                            {cmd.usage}
                          </span>
                        )}
                      </div>
                      {cmd.description && (
                        <span className="whitespace-pre-line break-words text-xs leading-snug text-muted-foreground">
                          {cmd.description}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ))
        )}
      </div>
      {/* 底部快捷键提示(2026-07-29 立,带 kbd 样式) */}
      <div className="flex items-center gap-2 border-t border-border/50 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="rounded-sm border border-border bg-background px-1 py-px font-mono text-[9px] leading-none">
            ↑↓
          </kbd>
          选择
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="flex items-center gap-1">
          <kbd className="rounded-sm border border-border bg-background px-1 py-px font-mono text-[9px] leading-none">
            Enter
          </kbd>
          确认
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="flex items-center gap-1">
          <kbd className="rounded-sm border border-border bg-background px-1 py-px font-mono text-[9px] leading-none">
            ESC
          </kbd>
          关闭
        </span>
        <span className="ml-auto text-muted-foreground/60">{flatItems.length} 个命令</span>
      </div>
    </div>
  )

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      content={content}
      position="top"
      align="start"
      trigger="click"
      portal
      tooltip={tooltip}
      className="w-96 overflow-hidden p-0 shadow-lg"
    >
      {children}
    </Popover>
  )
}

export default SlashCommandPalette
