'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Search, X, ArrowLeft, Sparkles, Loader2 } from 'lucide-react'
import { Input } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { Popover } from '@/components/feedback'

/** 命令分组(2026-07-29 立,按重要性排序)
 * 2026-07-29 二次深化:新增 skill 分组(AI 技能,从 /api/ai-skills 拉取) */
export type SlashCommandCategory = 'goal' | 'mode' | 'permission' | 'skill' | 'template'

/** 参数候选项(2026-07-29 立,用于 /goal /loop 等带参数命令的补全) */
export interface ArgSuggestion {
  /** 候选项标签(显示在主位) */
  label: string
  /** 候选项描述(显示在副位,小字) */
  description?: string
  /** 选中后插入 textarea 的完整文本(含命令前缀,如 "/goal 修复所有 TS 错误") */
  insertText: string
  /** 可选图标(覆盖默认 Sparkles) */
  icon?: React.ReactNode
}

interface Command {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  /** 命令类型(2026-07-25 立):
   * - 'template'(默认):选命令后填充模板到 textarea
   * - 'action':选命令后执行动作(如切换模式),不填充 textarea */
  kind?: 'template' | 'action'
  /** 命令分组(2026-07-29 立,深度重构):goal=目标与循环 / mode=模式切换 / permission=权限管理 / skill=AI 技能 / template=内容模板 */
  category?: SlashCommandCategory
  /** 命令用法提示(2026-07-29 立),如 "/goal <目标条件>",显示在命令项右侧 mono 小字 */
  usage?: string
  /** 是否需要参数(2026-07-29 立):true 时点击后填充命令到 textarea 让用户继续输入,false 时直接执行 */
  hasArgs?: boolean
  /** 参数候选列表(2026-07-29 二次深化):非空时点击命令进入"参数补全模式",
   * 显示候选列表供用户选择;为空或 undefined 时点击命令直接填充 usage 模板 */
  argsSuggestions?: ArgSuggestion[]
  /** 参数补全模式标题(如"选择目标模板"),空时用 label 作标题 */
  argsTitle?: string
  /** skill 命令是否加载中(2026-07-29 立,skill 列表异步拉取时显示 spinner) */
  loading?: boolean
}

interface SlashCommandPaletteProps {
  commands: Command[]
  /** 选中命令(无参数候选时)回调 */
  onSelect: (id: string) => void
  /** 选中参数候选项回调(2026-07-29 立,参数补全模式) */
  onSelectArgs?: (commandId: string, insertText: string) => void
  open: boolean
  /** 受控开关回调:点击 trigger / ESC / 选命令 / 点外部 都通过此回调同步外部 state */
  onOpenChange: (open: boolean) => void
  /** trigger 元素(斜杠按钮),弹层锚定到该元素上方 */
  children: React.ReactElement
  /** hover 时显示的轻量文字提示(可选,由 Popover 内部 Tooltip 渲染) */
  tooltip?: React.ReactNode
}

/** 分组元信息(2026-07-29 立,深度重构:命令分组提升可发现性)
 * 2026-07-29 二次深化:新增 skill 分组(AI 技能,Sparkles 图标)
 * - label:分组小标题(text-[10px] uppercase tracking-wider text-muted-foreground/60)
 * - icon:分组图标(小标题左侧)
 * - 顺序:goal(重点)→ mode → permission → skill → template */
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
  skill: {
    label: 'AI 技能',
    icon: <Sparkles className="h-3 w-3" />,
  },
  template: {
    label: '内容模板',
    icon: <span className="text-[10px]">📝</span>,
  },
}

const CATEGORY_ORDER: SlashCommandCategory[] = ['goal', 'mode', 'permission', 'skill', 'template']

/** 分组图标颜色(左侧 icon 着色,提升视觉层次) */
const CATEGORY_ICON_COLOR: Record<SlashCommandCategory, string> = {
  goal: 'text-primary',
  mode: 'text-blue-500 dark:text-blue-400',
  permission: 'text-amber-500 dark:text-amber-400',
  skill: 'text-violet-500 dark:text-violet-400',
  template: 'text-muted-foreground',
}

/**
 * 斜杠命令面板(2026-07-29 深度重构:三段式布局 + 分组 + 图标 + 视觉层次 + 参数补全 + skill 接入)。
 *
 * 设计目标(对标 Cursor / Claude Code / Codex 命令面板):
 * - 三段式布局:顶部搜索框(带 Search 图标 + clear)→ 中部分组命令列表 → 底部快捷键提示
 * - 命令分组:goal(目标与循环,置顶重点)→ mode(模式切换)→ permission(权限管理)→ skill(AI 技能)→ template(内容模板)
 * - 每命令配 lucide 图标,按分组着色,提升视觉辨识度
 * - 视觉层次:label 粗体 + description 浅色小字 + usage mono 提示
 * - active 项:左侧 2px primary 高亮条 + bg-accent,键盘导航清晰可见
 * - 参数补全模式(2026-07-29 二次深化):点带 argsSuggestions 的命令后,弹窗切换为候选列表,
 *   顶部显示"返回 + 标题",用户选候选项后填充 insertText 到 textarea
 * - skill 接入(2026-07-29 二次深化):skill 分组通过 props.commands 传入,message-input 拉取
 *   /api/ai-skills 后组装成 Command 项,点击后填充 /skill <name> 到 textarea
 * - footer 快捷键提示:↑↓ 选择 · Enter 确认 · ESC 关闭,带 kbd 样式
 *
 * 弹层用 Popover position="top" align="start" portal,锚定 trigger 按钮上方,
 * 无遮罩轻弹出,符合"按钮上方轻弹出"的视觉预期。
 */
export function SlashCommandPalette({
  commands,
  onSelect,
  onSelectArgs,
  open,
  onOpenChange,
  children,
  tooltip,
}: SlashCommandPaletteProps) {
  const t = useTranslations('slashPalette')
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  /** 参数补全模式(2026-07-29 二次深化):非空时显示候选列表,空时显示命令列表 */
  const [argMode, setArgMode] = React.useState<{
    commandId: string
    title: string
    suggestions: ArgSuggestion[]
  } | null>(null)
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

  // 参数补全模式的候选列表(过滤后)
  const argSuggestions = React.useMemo(() => {
    if (!argMode) return []
    const q = query.trim().toLowerCase()
    if (!q) return argMode.suggestions
    return argMode.suggestions.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false) ||
        s.insertText.toLowerCase().includes(q),
    )
  }, [argMode, query])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      setArgMode(null)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [filtered.length, argMode, argSuggestions.length])

  // active 项滚动到可视区(键盘导航时不被遮挡)
  React.useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const total = argMode ? argSuggestions.length : flatItems.length
      setActiveIndex((i) => (i + 1) % Math.max(total, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const total = argMode ? argSuggestions.length : flatItems.length
      setActiveIndex((i) => (i - 1 + total) % Math.max(total, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (argMode) {
        const item = argSuggestions[activeIndex]
        if (item) {
          onSelectArgs?.(argMode.commandId, item.insertText)
          onOpenChange(false)
        }
      } else {
        const cmd = flatItems[activeIndex]
        if (cmd) {
          // 有参数候选 → 进入参数补全模式(不关闭弹窗,不清空搜索)
          if (cmd.argsSuggestions && cmd.argsSuggestions.length > 0 && onSelectArgs) {
            setArgMode({
              commandId: cmd.id,
              title: cmd.argsTitle ?? cmd.label,
              suggestions: cmd.argsSuggestions,
            })
            setQuery('')
            setActiveIndex(0)
          } else {
            onSelect(cmd.id)
            onOpenChange(false)
          }
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (argMode) {
        // 参数补全模式 ESC 返回命令列表(不关闭弹窗)
        setArgMode(null)
        setQuery('')
      } else {
        onOpenChange(false)
      }
    } else if (e.key === 'Backspace' && query === '' && argMode) {
      // 参数补全模式下退格键返回命令列表
      e.preventDefault()
      setArgMode(null)
    }
  }

  let runningIdx = -1 // 扁平索引累加器(跨分组连续编号)

  const content = (
    <div className="flex flex-col">
      {/* 顶部搜索框(2026-07-29 二次深化:参数补全模式前置返回按钮 + 标题)
       *  - 普通模式:Search 图标 + 搜索框 + clear
       *  - 参数补全模式:返回按钮 + 标题 + 搜索框 + clear(键盘导航仍可用) */}
      <div className="relative flex items-center gap-2 bg-muted/30 px-3 py-2">
        {argMode ? (
          <button
            type="button"
            onClick={() => {
              setArgMode(null)
              setQuery('')
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
            aria-label={t('backAriaLabel')}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Search className="pointer-events-none h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        {argMode && (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {argMode.title}
          </span>
        )}
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={argMode ? '搜索候选...' : '搜索命令...'}
          className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('clearAriaLabel')}
            className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {/* 中部:参数补全模式显示候选列表;普通模式显示分组命令列表 */}
      <div ref={listRef} className="thin-scroll max-h-80 overflow-y-auto p-1.5">
        {argMode ? (
          // 参数补全模式:候选列表(无分组)
          argSuggestions.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-8 text-center">
              <p className="text-sm text-muted-foreground">无匹配候选</p>
              <p className="text-[10px] text-muted-foreground/60">尝试清空搜索或按 ESC 返回</p>
            </div>
          ) : (
            argSuggestions.map((suggestion, idx) => {
              const isActive = idx === activeIndex
              return (
                <button
                  key={suggestion.insertText}
                  type="button"
                  data-cmd-idx={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    onSelectArgs?.(argMode.commandId, suggestion.insertText)
                    onOpenChange(false)
                  }}
                  className={cn(
                    'relative flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/50',
                  )}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-sm bg-primary"
                      aria-hidden="true"
                    />
                  )}
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-violet-500 dark:text-violet-400">
                    {suggestion.icon ?? <Sparkles className="h-3.5 w-3.5" />}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="break-words text-sm font-medium leading-tight">
                      {suggestion.label}
                    </span>
                    {suggestion.description && (
                      <span className="whitespace-pre-line break-words text-xs leading-snug text-muted-foreground">
                        {suggestion.description}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )
        ) : // 普通模式:分组命令列表
        flatItems.length === 0 ? (
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
                {/* skill 分组 loading 状态(2026-07-29 立) */}
                {group.items.some((c) => c.loading) && (
                  <Loader2 className="ml-auto h-3 w-3 animate-spin text-muted-foreground/60" />
                )}
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
                      // 有参数候选 → 进入参数补全模式(不关闭弹窗)
                      if (cmd.argsSuggestions && cmd.argsSuggestions.length > 0 && onSelectArgs) {
                        setArgMode({
                          commandId: cmd.id,
                          title: cmd.argsTitle ?? cmd.label,
                          suggestions: cmd.argsSuggestions,
                        })
                        setQuery('')
                        setActiveIndex(0)
                      } else {
                        onSelect(cmd.id)
                        onOpenChange(false)
                      }
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
      {/* 底部快捷键提示(2026-07-29 立,带 kbd 样式)
       * 参数补全模式下提示 ESC 返回;普通模式提示 ESC 关闭 */}
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
          {argMode ? '返回' : '关闭'}
        </span>
        {argMode && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="flex items-center gap-1">
              <kbd className="rounded-sm border border-border bg-background px-1 py-px font-mono text-[9px] leading-none">
                ⌫
              </kbd>
              返回
            </span>
          </>
        )}
        <span className="ml-auto text-muted-foreground/60">
          {argMode ? `${argSuggestions.length} 个候选` : `${flatItems.length} 个命令`}
        </span>
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
