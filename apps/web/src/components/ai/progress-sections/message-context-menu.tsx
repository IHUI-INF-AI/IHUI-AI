'use client'

import * as React from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  FileText,
  MessageSquareWarning,
  RefreshCw,
  Search,
  Share2,
  Trash2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { ContextMenuAction, ContextMenuItem } from '@/hooks/use-context-menu'

/**
 * MessageContextMenu(2026-07-28 立,Phase 19 深度对标 Trae Work 对话体验)
 *
 * 用途:为消息气泡提供 Trae Work 风格的右键上下文菜单,支持:
 * - 复制文本(纯文本)
 * - 复制为 Markdown(保留代码块/列表/标题格式)
 * - 重新生成(仅 assistant 消息,触发重新生成)
 * - 反馈(like/dislike 二选一,弹出浮层或直接切换)
 * - 分享(生成可分享 URL,弹 toast 提示)
 * - 折叠到计划(仅含 plan step 关联的 assistant 消息,跳转到右侧 plan)
 * - 删除(从对话中移除,带确认)
 *
 * 视觉:popover 浮层风格,菜单项 hover 时浅色背景,危险项红色文字 + 红色 hover,
 *  支持快捷键显示 + 禁用态(loading/empty) + 图标 + 文字 + 子菜单。
 *
 * 位置:由父组件传入 visible + position,本组件负责渲染 + 边界检测 + 点击外部关闭。
 */

interface MessageContextMenuProps {
  visible: boolean
  position: { x: number; y: number }
  items: ContextMenuItem[]
  onAction: (action: ContextMenuAction, item: ContextMenuItem) => void
  onClose: () => void
  className?: string
  'data-testid'?: string
}

function buildIcon(action?: ContextMenuAction): React.ReactNode {
  if (!action) return null
  switch (action) {
    case 'copy':
      return <Copy className="h-3 w-3" aria-hidden />
    case 'copyMarkdown':
      return <FileText className="h-3 w-3" aria-hidden />
    case 'regenerate':
      return <RefreshCw className="h-3 w-3" aria-hidden />
    case 'feedback':
      return <MessageSquareWarning className="h-3 w-3" aria-hidden />
    case 'share':
      return <Share2 className="h-3 w-3" aria-hidden />
    case 'delete':
      return <Trash2 className="h-3 w-3" aria-hidden />
    case 'collapseToPlan':
      return <Clipboard className="h-3 w-3" aria-hidden />
    case 'search':
      return <Search className="h-3 w-3" aria-hidden />
    default:
      return null
  }
}

const MenuItem = React.memo(function MenuItem({
  item,
  onAction,
  depth = 0,
}: {
  item: ContextMenuItem
  onAction: (action: ContextMenuAction, item: ContextMenuItem) => void
  depth?: number
}) {
  if (item.separator) {
    return <div className="my-0.5 h-px bg-border/60" role="separator" aria-hidden />
  }

  if (item.children && item.children.length > 0) {
    return (
      <div className="space-y-0.5">
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] text-muted-foreground/70',
            depth > 0 && 'pl-4',
          )}
        >
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          <span className="flex-1 truncate font-medium">{item.label}</span>
        </div>
        <div className="space-y-0.5">
          {item.children.map((child) => (
            <MenuItem key={child.id} item={child} onAction={onAction} depth={depth + 1} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => item.action && onAction(item.action, item)}
      disabled={item.disabled}
      data-testid={`message-context-menu-item-${item.action ?? item.id}`}
      data-action={item.action ?? item.id}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[11px] transition-colors',
        'hover:bg-accent/50 hover:text-foreground focus-visible:bg-accent/50 focus-visible:outline-none',
        item.disabled && 'cursor-not-allowed opacity-50',
        item.danger && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
        !item.danger && !item.disabled && 'text-foreground/90',
      )}
    >
      <span className="shrink-0 text-muted-foreground/70">
        {item.icon ?? buildIcon(item.action)}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.shortcut && (
        <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground/50">
          {item.shortcut}
        </span>
      )}
    </button>
  )
})

export const MessageContextMenu = React.memo(function MessageContextMenu({
  visible,
  position,
  items,
  onAction,
  onClose,
  className,
  'data-testid': testId,
}: MessageContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = React.useState(position)

  // 边界检测:避免菜单超出视口
  React.useEffect(() => {
    if (!visible) return
    const el = menuRef.current
    if (!el) {
      setAdjustedPosition(position)
      return
    }
    const rect = el.getBoundingClientRect()
    let x = position.x
    let y = position.y
    if (typeof window !== 'undefined') {
      const vw = window.innerWidth
      const vh = window.innerHeight
      if (x + rect.width > vw) x = Math.max(8, vw - rect.width - 8)
      if (y + rect.height > vh) y = Math.max(8, vh - rect.height - 8)
    }
    setAdjustedPosition({ x, y })
  }, [visible, position])

  // 点击外部关闭 + Esc 关闭
  React.useEffect(() => {
    if (!visible) return
    const onClickOutside = (e: MouseEvent) => {
      const el = menuRef.current
      if (el && !el.contains(e.target as Node)) {
        onClose()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    // 延迟绑定,避免打开时的同一次右键立即触发关闭
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onClickOutside)
      document.addEventListener('contextmenu', onClickOutside)
    }, 0)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('contextmenu', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [visible, onClose])

  if (!visible) return null

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="消息操作菜单"
      data-testid={testId ?? 'message-context-menu'}
      className={cn(
        'fixed z-[1100] min-w-[180px] max-w-[260px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        className,
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {items.length === 0 ? (
        <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground/60">
          <Check className="h-3 w-3" aria-hidden />
          无可用操作
        </div>
      ) : (
        <div className="space-y-0.5" role="group">
          {items.map((item) => (
            <MenuItem key={item.id} item={item} onAction={onAction} />
          ))}
        </div>
      )}
    </div>
  )
})

export default MessageContextMenu

/**
 * MessageSearchBar(2026-07-29 立,Phase 23)
 *
 * 消息搜索栏,固定在消息列表顶部(sticky top-0),深度对标 Trae Work / Codex 右键菜单搜索体验。
 * - 输入关键词 → onSearch 回调(由父组件执行搜索 + 更新结果)
 * - 结果计数 "3/12" 在输入框右侧
 * - 上一个/下一个按钮(ChevronUp / ChevronDown)切换 currentIndex
 * - Esc 关闭;Ctrl+Enter 下一个,Shift+Ctrl+Enter 上一个
 * - 样式:rounded-md 输入框(非 rounded-full),stroke 用 muted-foreground/20(无蓝色发光)
 */
export interface MessageSearchBarProps {
  visible: boolean
  onClose: () => void
  onSearch: (query: string) => void
  resultCount: number
  currentIndex: number
  onNavigate: (direction: 'prev' | 'next') => void
}

export const MessageSearchBar = React.memo(function MessageSearchBar({
  visible,
  onClose,
  onSearch,
  resultCount,
  currentIndex,
  onNavigate,
}: MessageSearchBarProps) {
  const t = useTranslations('chat')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [query, setQuery] = React.useState('')

  // visible 变 true 时自动聚焦输入框
  React.useEffect(() => {
    if (visible) {
      // 延迟一帧聚焦,确保 DOM 已渲染
      const id = window.requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
      return () => window.cancelAnimationFrame(id)
    }
    // 关闭时清空查询
    setQuery('')
  }, [visible])

  // 键盘快捷键:Esc 关闭 / Ctrl+Enter 下一个 / Shift+Ctrl+Enter 上一个
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        onNavigate(e.shiftKey ? 'prev' : 'next')
      }
    },
    [onClose, onNavigate],
  )

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setQuery(val)
      onSearch(val)
    },
    [onSearch],
  )

  const handlePrev = React.useCallback(() => onNavigate('prev'), [onNavigate])
  const handleNext = React.useCallback(() => onNavigate('next'), [onNavigate])

  if (!visible) return null

  const hasResult = resultCount > 0
  const resultLabel = hasResult
    ? t('searchResult', { current: currentIndex + 1, total: resultCount })
    : t('searchNoResult')
  const prevDisabled = !hasResult || resultCount <= 1
  const nextDisabled = !hasResult || resultCount <= 1

  return (
    <div
      className="sticky top-0 z-20 flex shrink-0 items-center gap-1.5 border-b border-border/40 bg-background/95 px-3 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      data-testid="message-search-bar"
      role="search"
      aria-label={t('search')}
    >
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={t('searchPlaceholder')}
        aria-label={t('search')}
        data-testid="message-search-input"
        className={cn(
          'h-7 w-44 rounded-md border border-muted-foreground/20 bg-transparent px-2 text-xs text-foreground',
          'placeholder:text-muted-foreground/50 focus:outline-none focus:border-muted-foreground/40',
        )}
      />
      <span
        className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70"
        data-testid="message-search-result-count"
        aria-live="polite"
      >
        {resultLabel}
      </span>
      <button
        type="button"
        onClick={handlePrev}
        disabled={prevDisabled}
        aria-label={t('searchPrev')}
        title={t('searchPrev')}
        data-testid="message-search-prev"
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors',
          'hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
          prevDisabled &&
            'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground',
        )}
      >
        <ChevronUp className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={handleNext}
        disabled={nextDisabled}
        aria-label={t('searchNext')}
        title={t('searchNext')}
        data-testid="message-search-next"
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors',
          'hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
          nextDisabled &&
            'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground',
        )}
      >
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('searchClose')}
        title={t('searchClose')}
        data-testid="message-search-close"
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors',
          'hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
        )}
      >
        ×
      </button>
    </div>
  )
})

/**
 * 工具函数:规范化 markdown 文本的空白字符(行尾符 + 连续空行 + 首尾空白),
 * 让用户在 notion/obsidian 粘贴时仍可读。函数仅做空白处理,不转换 markdown 结构。
 *
 * 2026-07-28 改名为 normalizeMarkdown(原名 markdownForClipboard 易与
 * plainTextForClipboard 混淆,且"复制为 Markdown"语境下旧名暗示会做格式转换)。
 */
export function normalizeMarkdown(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * @deprecated 请改用 `normalizeMarkdown` —— 旧名暗示"做 markdown 转换",实际只规范化空白。
 * 保留此别名仅用于外部测试/老调用方平滑迁移,新代码请勿使用。
 */
export function markdownForClipboard(content: string): string {
  return normalizeMarkdown(content)
}

/** 工具函数:把 markdown 转换为简化纯文本(用于"复制文本") */
export function plainTextForClipboard(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?|```/g, '').trim())
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
