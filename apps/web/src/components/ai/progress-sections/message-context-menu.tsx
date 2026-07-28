'use client'

import * as React from 'react'
import { Copy, RefreshCw, ThumbsUp, ThumbsDown, Share2, ChevronsUp, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContextMenuItem, ContextMenuAction } from '@/hooks/use-context-menu'

/**
 * defaultMessageMenuItems — 消息气泡的默认右键菜单项(2026-07-28 立)
 */
export function defaultMessageMenuItems(_message: {
  id: string
  content: string
}): ContextMenuItem[] {
  return [
    {
      id: 'copy',
      label: '复制',
      action: 'copy',
      icon: <Copy className="h-3 w-3" />,
      shortcut: '⌘C',
    },
    { id: 'copyMarkdown', label: '复制为 Markdown', action: 'copyMarkdown' },
    { id: 'sep-1', label: '', separator: true },
    {
      id: 'regenerate',
      label: '重新生成',
      action: 'regenerate',
      icon: <RefreshCw className="h-3 w-3" />,
    },
    {
      id: 'feedback',
      label: '反馈',
      action: 'feedback',
      children: [
        { id: 'up', label: '👍 有帮助', action: 'feedback', icon: <ThumbsUp className="h-3 w-3" /> },
        { id: 'down', label: '👎 没帮助', action: 'feedback', icon: <ThumbsDown className="h-3 w-3" /> },
      ],
    },
    { id: 'sep-2', label: '', separator: true },
    {
      id: 'share',
      label: '分享',
      action: 'share',
      icon: <Share2 className="h-3 w-3" />,
    },
    {
      id: 'collapseToPlan',
      label: '折叠到 Plan',
      action: 'collapseToPlan',
      icon: <ChevronsUp className="h-3 w-3" />,
    },
    { id: 'sep-3', label: '', separator: true },
    {
      id: 'delete',
      label: '删除',
      action: 'delete',
      icon: <Trash2 className="h-3 w-3" />,
      danger: true,
    },
  ]
}

/**
 * MessageContextMenu — 消息气泡的右键菜单(2026-07-28 立,Trae Work 对齐)
 *
 * 设计:
 * - fixed 定位 + 边界检测
 * - 点击外部 / Esc 关闭
 * - 子菜单(feedback 反馈)
 * - 危险项(danger)红色
 * - 快捷键提示(shortcut 右对齐)
 */

interface MessageContextMenuProps {
  visible: boolean
  position: { x: number; y: number }
  items: ContextMenuItem[]
  onAction?: (action: ContextMenuAction, item: ContextMenuItem) => void
  onClose: () => void
  className?: string
  'data-testid'?: string
}

interface MenuItemRowProps {
  item: ContextMenuItem
  onAction?: (action: ContextMenuAction, item: ContextMenuItem) => void
  onClose: () => void
}

const MenuItemRow = React.memo(function MenuItemRow({
  item,
  onAction,
  onClose,
}: MenuItemRowProps) {
  const [subOpen, setSubOpen] = React.useState(false)
  const [hoverTimer, setHoverTimer] = React.useState<ReturnType<typeof setTimeout> | null>(null)
  const itemRef = React.useRef<HTMLDivElement>(null)

  if (item.separator) {
    return <div className="my-1 h-px bg-border/60" role="separator" />
  }

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (item.disabled) return
    if (item.action) {
      onAction?.(item.action, item)
      onClose()
    }
  }

  const onMouseEnter = () => {
    if (hoverTimer) {
      clearTimeout(hoverTimer)
      setHoverTimer(null)
    }
    if (item.children && item.children.length > 0) {
      setSubOpen(true)
    }
  }
  const onMouseLeave = () => {
    if (item.children && item.children.length > 0) {
      const t = setTimeout(() => setSubOpen(false), 150)
      setHoverTimer(t)
    }
  }

  return (
    <div
      ref={itemRef}
      className="relative"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        disabled={item.disabled}
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[11px] transition-colors',
          item.disabled
            ? 'cursor-not-allowed text-muted-foreground/40'
            : item.danger
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-foreground/90 hover:bg-accent',
        )}
        role="menuitem"
      >
        {item.icon && <span className="shrink-0">{item.icon}</span>}
        <span className="flex-1">{item.label}</span>
        {item.shortcut && (
          <span className="shrink-0 text-[9px] text-muted-foreground/60">{item.shortcut}</span>
        )}
        {item.children && item.children.length > 0 && (
          <span className="shrink-0 text-muted-foreground/60">▶</span>
        )}
      </button>
      {item.children && subOpen && (
        <div
          className="absolute left-full top-0 ml-1 min-w-[140px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          role="menu"
        >
          {item.children.map((child) => (
            <MenuItemRow
              key={child.id}
              item={child}
              onAction={onAction}
              onClose={onClose}
            />
          ))}
        </div>
      )}
    </div>
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
  // 边界检测
  const [adjustedPos, setAdjustedPos] = React.useState(position)
  React.useEffect(() => {
    if (!visible) return
    const W = 200 // 估计菜单宽度
    const H = items.length * 26 + 12 // 估计菜单高度
    let { x, y } = position
    if (typeof window !== 'undefined') {
      if (x + W > window.innerWidth) x = Math.max(4, window.innerWidth - W - 4)
      if (y + H > window.innerHeight) y = Math.max(4, window.innerHeight - H - 4)
    }
    setAdjustedPos({ x, y })
  }, [visible, position, items.length])

  // Esc 关闭
  React.useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, onClose])

  // 点击外部关闭
  React.useEffect(() => {
    if (!visible) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-testid="message-context-menu"]')) return
      onClose()
    }
    // 延迟绑定避免打开时立即关闭
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onClick)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onClick)
    }
  }, [visible, onClose])

  if (!visible) return null

  return (
    <div
      className={cn(
        'fixed z-[1000] min-w-[180px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
        className,
      )}
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      data-testid={testId ?? 'message-context-menu'}
      role="menu"
    >
      {items.map((item) => (
        <MenuItemRow
          key={item.id}
          item={item}
          onAction={onAction}
          onClose={onClose}
        />
      ))}
    </div>
  )
})

export default MessageContextMenu
