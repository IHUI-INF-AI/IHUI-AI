'use client'

import * as React from 'react'
import { ChevronRight, Copy, RefreshCw, Share2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContextMenuItem } from '@/hooks/use-context-menu'

/**
 * defaultMessageMenuItems — 默认消息右键菜单项生成器(2026-07-28 立,Trae Work 对齐)
 * 放在 .tsx 文件中可以包含 JSX(原 use-context-menu.ts 不支持 JSX,故迁移到这里)
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

/**
 * MessageContextMenu — 消息气泡的右键上下文菜单(2026-07-28 立,Trae Work 对齐)
 *
 * 设计目标:
 * - 每条消息气泡支持右键弹出菜单
 * - 默认菜单:复制/复制为Markdown/重新生成/反馈/分享/折叠到Plan/删除
 * - 支持嵌套子菜单(反馈 → 👍/👎)
 * - Esc 关闭 / 点击外部关闭
 * - ARIA role="menu" + keyboard navigation
 */

interface MessageContextMenuProps {
  visible: boolean
  position: { x: number; y: number }
  items: ContextMenuItem[]
  onItemClick: (item: ContextMenuItem) => void
  onClose: () => void
}

const MenuEntry = React.memo(function MenuEntry({
  item,
  depth,
  onItemClick,
  onClose,
}: {
  item: ContextMenuItem
  depth: number
  onItemClick: (item: ContextMenuItem) => void
  onClose: () => void
}) {
  if (item.separator) {
    return <div className="my-0.5 h-px bg-border/60" role="separator" />
  }

  if (item.children && item.children.length > 0) {
    return (
      <div className="group/submenu relative">
        <button
          type="button"
          role="menuitem"
          aria-haspopup="true"
          disabled={item.disabled}
          onClick={() => {
            /* hover submenu instead */
          }}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-sm px-2 py-0.5 text-left text-[11px] transition-colors',
            item.disabled
              ? 'cursor-not-allowed text-muted-foreground/50'
              : 'text-foreground/90 hover:bg-accent/60',
          )}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          <span className="flex-1">{item.label}</span>
          {item.shortcut && (
            <span className="shrink-0 text-[10px] text-muted-foreground/60">{item.shortcut}</span>
          )}
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
        </button>
        <div
          className={cn(
            'absolute left-full top-0 ml-0.5 hidden min-w-[140px] rounded-md border border-border bg-card p-0.5 shadow-md',
            'group-hover/submenu:block',
          )}
          role="menu"
        >
          {item.children.map((c) => (
            <MenuEntry
              key={c.id}
              item={c}
              depth={depth + 1}
              onItemClick={onItemClick}
              onClose={onClose}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.disabled}
      onClick={() => {
        if (item.disabled) return
        onItemClick(item)
        onClose()
      }}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-sm px-2 py-0.5 text-left text-[11px] transition-colors',
        item.disabled
          ? 'cursor-not-allowed text-muted-foreground/50'
          : item.danger
            ? 'text-red-500 hover:bg-red-500/10'
            : 'text-foreground/90 hover:bg-accent/60',
      )}
      style={{ paddingLeft: 8 + depth * 12 }}
    >
      {item.icon && <span className="shrink-0">{item.icon}</span>}
      <span className="flex-1">{item.label}</span>
      {item.shortcut && (
        <span className="shrink-0 text-[10px] text-muted-foreground/60">{item.shortcut}</span>
      )}
    </button>
  )
})

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
      style={
        {
          position: 'fixed',
          top: position.y,
          left: position.x,
          zIndex: 9999,
        } as React.CSSProperties
      }
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
