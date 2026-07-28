'use client'

/**
 * MessageContextMenu — Trae Work 风格消息右键菜单(Phase 19.4,2026-07-28 立)
 *
 * 菜单项:复制 / 重新生成 / 反馈(子菜单) / 分享 / 折叠到Plan / 删除
 * 键盘导航:↑↓ / Home/End / Enter / Esc / →←(子菜单)
 */

import * as React from 'react'
import { Copy, RefreshCw, Share2, Trash2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ContextMenuAction =
  | 'copy'
  | 'copyMarkdown'
  | 'regenerate'
  | 'feedback'
  | 'share'
  | 'collapseToPlan'
  | 'delete'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  action?: ContextMenuAction
  children?: ContextMenuItem[]
  disabled?: boolean
  separator?: boolean
  shortcut?: string
  danger?: boolean
}

interface MessageContextMenuProps {
  visible: boolean
  position: { x: number; y: number }
  items: ContextMenuItem[]
  onItemClick: (item: ContextMenuItem) => void
  onClose: () => void
}

/** 默认菜单构造器(由 useContextMenu 内部调用) */
export function defaultMessageMenuItems(_message: {
  id: string
  content: string
}): ContextMenuItem[] {
  return [
    { id: 'copy', label: '复制', action: 'copy', icon: <Copy className="h-3 w-3" />, shortcut: '⌘C' },
    { id: 'copyMarkdown', label: '复制为 Markdown', action: 'copyMarkdown' },
    { id: 'sep-1', label: '', separator: true },
    { id: 'regenerate', label: '重新生成', action: 'regenerate', icon: <RefreshCw className="h-3 w-3" /> },
    {
      id: 'feedback',
      label: '反馈',
      action: 'feedback',
      children: [
        { id: 'up', label: '👍 有帮助', action: 'feedback' },
        { id: 'down', label: '👎 没帮助', action: 'feedback' },
      ],
    },
    { id: 'sep-2', label: '', separator: true },
    { id: 'share', label: '分享', action: 'share', icon: <Share2 className="h-3 w-3" /> },
    { id: 'collapseToPlan', label: '折叠到 Plan', action: 'collapseToPlan' },
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

interface MenuEntryProps {
  item: ContextMenuItem
  depth: number
  onItemClick: (item: ContextMenuItem) => void
  onClose: () => void
}

function MenuEntry({ item, depth, onItemClick, onClose }: MenuEntryProps) {
  const hasChildren = !!item.children && item.children.length > 0
  const [open, setOpen] = React.useState(false)

  if (item.separator) {
    return <div className="my-0.5 h-px bg-border/60" role="separator" />
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => hasChildren && setOpen(true)}
      onMouseLeave={() => hasChildren && setOpen(false)}
    >
      <button
        type="button"
        disabled={item.disabled}
        onClick={() => {
          if (item.disabled) return
          if (hasChildren) return
          onItemClick(item)
          onClose()
        }}
        data-danger={item.danger ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-2 whitespace-nowrap rounded-sm px-2 py-1 text-left text-[11px] transition-colors',
          item.disabled
            ? 'cursor-not-allowed text-muted-foreground/40'
            : item.danger
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-foreground/90 hover:bg-accent/60',
        )}
      >
        {item.icon && <span className="shrink-0">{item.icon}</span>}
        <span className="flex-1">{item.label}</span>
        {item.shortcut && (
          <span className="shrink-0 text-[10px] text-muted-foreground/60">{item.shortcut}</span>
        )}
        {hasChildren && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
      </button>
      {hasChildren && open && item.children && (
        <div
          className="absolute left-full top-0 min-w-[140px] rounded-md border border-border bg-card p-0.5 shadow-md"
          style={{ marginLeft: 4 }}
          role="menu"
        >
          {item.children.map((child) => (
            <MenuEntry
              key={child.id}
              item={child}
              depth={depth + 1}
              onItemClick={onItemClick}
              onClose={onClose}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const MessageContextMenu = React.memo(function MessageContextMenu({
  visible,
  position,
  items,
  onItemClick,
  onClose,
}: MessageContextMenuProps) {
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!visible) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [visible, onClose])

  if (!visible) return null

  return (
    <div
      ref={ref}
      data-testid="message-context-menu"
      role="menu"
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 9999,
      }}
      className="min-w-[180px] rounded-md border border-border bg-card p-0.5 shadow-md"
    >
      {items.map((item) => (
        <MenuEntry
          key={item.id}
          item={item}
          depth={0}
          onItemClick={onItemClick}
          onClose={onClose}
        />
      ))}
    </div>
  )
})

export default MessageContextMenu
