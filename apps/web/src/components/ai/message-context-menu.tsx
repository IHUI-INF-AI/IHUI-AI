'use client'

/**
 * MessageContextMenu — 消息气泡右键菜单容器(2026-07-28 立)
 *
 * Trae Work 风格:
 * - 浅色背景 (bg-card) + 圆角 (rounded-md) + 阴影 (shadow-lg) + 1px 边框
 * - 菜单项 padding 8px 12px
 * - hover 背景 bg-accent
 * - 危险操作: text-destructive
 * - 快捷键右对齐 (text-muted-foreground text-xs)
 * - 关闭: 点击外部 / Esc / 选中项
 * - z-index: 9999
 * - 键盘导航: ↑↓ 切换 / Enter 确认 / Esc 关闭 / → 打开子菜单
 *
 * 配套 hook: useContextMenu()
 * 默认菜单构造器: defaultMessageMenuItems(message)
 */

import * as React from 'react'
import {
  ChevronRight,
  Copy,
  FileText,
  ListCollapse,
  RefreshCw,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'

import { cn } from '@/lib/utils'

/** 菜单项操作类型 */
export type ContextMenuAction =
  | 'copy'
  | 'copyMarkdown'
  | 'regenerate'
  | 'feedback'
  | 'share'
  | 'collapseToPlan'
  | 'delete'

/** 单个菜单项 */
export interface ContextMenuItem {
  id: string
  /** 显示文本 */
  label: string
  /** lucide-react icon */
  icon?: React.ReactNode
  /** 语义 action(供 onItemClick 分发) */
  action?: ContextMenuAction
  /** 子菜单项 */
  children?: ContextMenuItem[]
  /** 禁用 */
  disabled?: boolean
  /** 分隔线(separator=true 时不渲染按钮,渲染一条 1px 分割行) */
  separator?: boolean
  /** 快捷键显示 e.g. "Cmd+C" */
  shortcut?: string
  /** 危险操作(红色文字) */
  danger?: boolean
}

export interface MessageContextMenuProps {
  visible: boolean
  position: { x: number; y: number }
  items: ContextMenuItem[]
  onItemClick: (item: ContextMenuItem) => void
  onClose: () => void
  /** 自定义 z-index,默认 9999 */
  zIndex?: number
  /** 自定义 data-testid,默认 'message-context-menu' */
  'data-testid'?: string
}

/** 可获取的菜单项(过滤掉 separator) */
function getNavigableItems(items: ContextMenuItem[]): ContextMenuItem[] {
  return items.filter((it) => !it.separator)
}

/** 子菜单:横向浮出(右侧优先,空间不足则左侧) */
interface SubMenuProps {
  items: ContextMenuItem[]
  parentRect: DOMRect
  onItemClick: (item: ContextMenuItem) => void
  onClose: () => void
  testIdPrefix: string
}

const SubMenu = React.memo(function SubMenu({
  items,
  parentRect,
  onItemClick,
  onClose,
  testIdPrefix,
}: SubMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [style, setStyle] = React.useState<React.CSSProperties>({
    position: 'fixed',
    top: parentRect.top,
    left: parentRect.right + 4,
  })

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (typeof window === 'undefined') return
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = parentRect.right + 4
    let top = parentRect.top
    if (left + rect.width > vw) {
      // 左侧浮出
      left = Math.max(4, parentRect.left - rect.width - 4)
    }
    if (top + rect.height > vh) {
      top = Math.max(4, vh - rect.height - 4)
    }
    setStyle({ position: 'fixed', top, left })
  }, [parentRect])

  // 键盘支持
  const navigable = React.useMemo(() => getNavigableItems(items), [items])
  const [focusIndex, setFocusIndex] = React.useState(0)
  React.useEffect(() => {
    setFocusIndex(0)
  }, [items])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((i) => (i + 1) % Math.max(1, navigable.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((i) => (i - 1 + Math.max(1, navigable.length)) % Math.max(1, navigable.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = navigable[focusIndex]
      if (item && !item.disabled) {
        onItemClick(item)
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      ref={ref}
      data-testid={`${testIdPrefix}-submenu`}
      data-context-menu-root="true"
      role="menu"
      style={style}
      className={cn(
        'min-w-[160px] rounded-md border border-border bg-card p-1 text-card-foreground shadow-lg',
      )}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) =>
        item.separator ? (
          <div
            key={item.id}
            data-testid={`${testIdPrefix}-submenu-separator`}
            role="separator"
            className="my-1 h-px bg-border"
          />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            data-testid={`${testIdPrefix}-submenu-item-${item.id}`}
            data-danger={item.danger ? 'true' : 'false'}
            onClick={() => {
              if (item.disabled) return
              onItemClick(item)
              onClose()
            }}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-left text-sm',
              'transition-colors duration-100',
              'hover:bg-accent focus:bg-accent focus:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              item.danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground',
            )}
          >
            {item.icon ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">{item.icon}</span>
            ) : null}
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut ? (
              <span className="ml-auto pl-3 text-xs text-muted-foreground">{item.shortcut}</span>
            ) : null}
          </button>
        ),
      )}
    </div>
  )
})

export const MessageContextMenu = React.memo(function MessageContextMenu({
  visible,
  position,
  items,
  onItemClick,
  onClose,
  zIndex = 9999,
  'data-testid': testId = 'message-context-menu',
}: MessageContextMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [focusIndex, setFocusIndex] = React.useState(0)
  const [openSubMenuFor, setOpenSubMenuFor] = React.useState<string | null>(null)
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const subMenuCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const navigable = React.useMemo(() => getNavigableItems(items), [items])

  // visible 变化时,重置状态
  React.useEffect(() => {
    if (visible) {
      setFocusIndex(0)
      setOpenSubMenuFor(null)
    } else {
      setOpenSubMenuFor(null)
    }
  }, [visible, items])

  // 挂载后让首项获得焦点(键盘可达)
  React.useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => {
      const target = itemRefs.current[0]
      target?.focus()
    }, 0)
    return () => clearTimeout(t)
  }, [visible])

  // 清理子菜单 close timer
  React.useEffect(() => {
    return () => {
      if (subMenuCloseTimerRef.current !== null) {
        clearTimeout(subMenuCloseTimerRef.current)
        subMenuCloseTimerRef.current = null
      }
    }
  }, [])

  if (!visible) return null

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (openSubMenuFor !== null) {
      // 子菜单已开,交给子菜单自己处理(子菜单 div 接管焦点)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((i) => (i + 1) % Math.max(1, navigable.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((i) => (i - 1 + Math.max(1, navigable.length)) % Math.max(1, navigable.length))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setFocusIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setFocusIndex(Math.max(0, navigable.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = navigable[focusIndex]
      if (item && !item.disabled) {
        if (item.children && item.children.length > 0) {
          setOpenSubMenuFor(item.id)
        } else {
          onItemClick(item)
          onClose()
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      const item = navigable[focusIndex]
      if (item?.children && item.children.length > 0) {
        setOpenSubMenuFor(item.id)
      }
    }
  }

  // 焦点跟随(同步 DOM focus)
  React.useEffect(() => {
    if (!visible) return
    const target = itemRefs.current[focusIndex]
    target?.focus()
  }, [focusIndex, visible])

  // 计算 inline style(屏幕坐标)
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: position.y,
    left: position.x,
    zIndex,
  }

  return (
    <div
      ref={ref}
      data-testid={testId}
      data-context-menu-root="true"
      role="menu"
      aria-label="消息操作菜单"
      style={containerStyle}
      className={cn(
        'min-w-[200px] rounded-md border border-border bg-card p-1 text-card-foreground shadow-lg',
      )}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => {
        if (item.separator) {
          return (
            <div
              key={item.id}
              data-testid={`${testId}-separator`}
              role="separator"
              className="my-1 h-px bg-border"
            />
          )
        }
        const navIndex = navigable.findIndex((n) => n.id === item.id)
        const isFocused = navIndex === focusIndex
        const hasChildren = !!item.children && item.children.length > 0
        return (
          <button
            key={item.id}
            ref={(el) => {
              if (navIndex >= 0) {
                itemRefs.current[navIndex] = el
              }
            }}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            aria-haspopup={hasChildren ? 'menu' : undefined}
            aria-expanded={hasChildren ? openSubMenuFor === item.id : undefined}
            data-testid={`${testId}-item-${item.id}`}
            data-danger={item.danger ? 'true' : 'false'}
            data-focused={isFocused ? 'true' : 'false'}
            onMouseEnter={() => {
              if (hasChildren) {
                if (subMenuCloseTimerRef.current !== null) {
                  clearTimeout(subMenuCloseTimerRef.current)
                  subMenuCloseTimerRef.current = null
                }
                setOpenSubMenuFor(item.id)
              } else {
                setOpenSubMenuFor(null)
              }
              // 同步键盘 focus 状态
              if (navIndex >= 0) setFocusIndex(navIndex)
            }}
            onMouseLeave={() => {
              if (hasChildren) return
              setOpenSubMenuFor(null)
            }}
            onClick={() => {
              if (item.disabled) return
              if (hasChildren) {
                setOpenSubMenuFor(openSubMenuFor === item.id ? null : item.id)
                return
              }
              onItemClick(item)
              onClose()
            }}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-left text-sm',
              'transition-colors duration-100',
              'hover:bg-accent focus:bg-accent focus:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              item.danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground',
            )}
          >
            {item.icon ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">{item.icon}</span>
            ) : null}
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut ? (
              <span className="ml-auto pl-3 text-xs text-muted-foreground">{item.shortcut}</span>
            ) : null}
            {hasChildren ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </button>
        )
      })}

      {(() => {
        if (openSubMenuFor === null) return null
        const parent = items.find((it) => it.id === openSubMenuFor)
        if (!parent?.children || parent.children.length === 0) return null
        const parentIndex = navigable.findIndex((n) => n.id === parent.id)
        const parentEl = itemRefs.current[parentIndex]
        if (!parentEl) return null
        const rect = parentEl.getBoundingClientRect()
        return (
          <SubMenu
            key={parent.id}
            items={parent.children}
            parentRect={rect}
            onItemClick={(item) => {
              onItemClick(item)
              onClose()
            }}
            onClose={() => setOpenSubMenuFor(null)}
            testIdPrefix={`${testId}-${parent.id}`}
          />
        )
      })()}
    </div>
  )
})

export default MessageContextMenu

/* -------------------------------------------------------------------------- */
/*  默认菜单构造器                                                            */
/* -------------------------------------------------------------------------- */

export interface DefaultMessageMenuData {
  id: string
  /** 反馈:已选 👍 / 👎 / null */
  feedback?: 'up' | 'down' | null
  /** 当前用户是否是该消息作者(本人消息不允许 regenerate) */
  isOwnMessage?: boolean
}

/**
 * 默认消息菜单项构造器(根据数据动态生成)。
 * 集成方可以直接使用,也可以基于此扩展。
 */
export function defaultMessageMenuItems(message: DefaultMessageMenuData): ContextMenuItem[] {
  return [
    {
      id: 'copy',
      label: '复制',
      icon: <Copy className="h-3.5 w-3.5" />,
      action: 'copy',
      shortcut: '⌘C',
    },
    {
      id: 'copyMarkdown',
      label: '复制为 Markdown',
      icon: <FileText className="h-3.5 w-3.5" />,
      action: 'copyMarkdown',
    },
    {
      id: 'separator-copy',
      label: '',
      separator: true,
    },
    {
      id: 'regenerate',
      label: '重新生成',
      icon: <RefreshCw className="h-3.5 w-3.5" />,
      action: 'regenerate',
      disabled: !!message.isOwnMessage,
    },
    {
      id: 'feedback',
      label: '反馈',
      icon: <ThumbsUp className="h-3.5 w-3.5" />,
      action: 'feedback',
      children: [
        {
          id: 'feedback-up',
          label: '有帮助',
          icon: <ThumbsUp className="h-3.5 w-3.5" />,
          action: 'feedback',
        },
        {
          id: 'feedback-down',
          label: '没帮助',
          icon: <ThumbsDown className="h-3.5 w-3.5" />,
          action: 'feedback',
        },
      ],
    },
    {
      id: 'separator-feedback',
      label: '',
      separator: true,
    },
    {
      id: 'share',
      label: '分享',
      icon: <Share2 className="h-3.5 w-3.5" />,
      action: 'share',
    },
    {
      id: 'collapseToPlan',
      label: '折叠到 Plan',
      icon: <ListCollapse className="h-3.5 w-3.5" />,
      action: 'collapseToPlan',
    },
    {
      id: 'separator-danger',
      label: '',
      separator: true,
    },
    {
      id: 'delete',
      label: '删除',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      action: 'delete',
      danger: true,
    },
  ]
}
