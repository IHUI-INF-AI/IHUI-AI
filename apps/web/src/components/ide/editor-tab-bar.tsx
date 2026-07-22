'use client'
import * as React from 'react'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { getFileColor, getFileIcon } from './file-icons'
import { X, Circle, Pin, Copy, XCircle, Files } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EditorTab } from '@ihui/types'

interface ContextMenuState {
  x: number
  y: number
  tabId: string
}

/** 根据文件名长度计算 tab 宽度(80–200px),中文按 2 字宽计算 */
function calcTabWidth(filename: string): number {
  const charWidth = [...filename].reduce(
    (s, ch) => s + (ch.charCodeAt(0) > 127 ? 14 : 7),
    0,
  )
  return Math.max(80, Math.min(200, charWidth + 48))
}

export function EditorTabBar() {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useIDEWorkspace()
  // pin 状态:从 store 的 isPinned 初始化,本地维护(zustand 未暴露 togglePin action)
  const [pinnedIds, setPinnedIds] = React.useState<Set<string>>(
    () => new Set(openTabs.filter((t) => t.isPinned).map((t) => t.id)),
  )
  // 本地维护 tab 顺序(支持拖拽重排),store 增删时同步
  const [order, setOrder] = React.useState<string[]>(() => openTabs.map((t) => t.id))
  const [dragId, setDragId] = React.useState<string | null>(null)
  const [overId, setOverId] = React.useState<string | null>(null)
  const [menu, setMenu] = React.useState<ContextMenuState | null>(null)

  // 同步 store 中 tab 增删到本地 order / pinnedIds
  React.useEffect(() => {
    setOrder((prev) => {
      const current = openTabs.map((t) => t.id)
      const kept = prev.filter((id) => current.includes(id))
      const added = current.filter((id) => !kept.includes(id))
      return [...kept, ...added]
    })
    setPinnedIds((prev) => {
      const ids = new Set(openTabs.map((t) => t.id))
      const next = new Set<string>()
      prev.forEach((id) => {
        if (ids.has(id)) next.add(id)
      })
      return next
    })
  }, [openTabs])

  // 排序:pinned 优先(左侧),然后按 order
  const sortedTabs = React.useMemo(() => {
    const byId = new Map(openTabs.map((t) => [t.id, t]))
    return order
      .map((id) => byId.get(id))
      .filter((t): t is EditorTab => Boolean(t))
      .sort((a, b) => {
        const ap = pinnedIds.has(a.id) ? 0 : 1
        const bp = pinnedIds.has(b.id) ? 0 : 1
        return ap - bp
      })
  }, [openTabs, order, pinnedIds])

  // 右键菜单关闭:点击外部 / Escape
  React.useEffect(() => {
    if (!menu) return
    const click = () => setMenu(null)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    window.addEventListener('click', click)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('click', click)
      window.removeEventListener('keydown', key)
    }
  }, [menu])

  if (openTabs.length === 0) return null

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const closeOthers = (id: string) => {
    sortedTabs
      .filter((t) => t.id !== id && !pinnedIds.has(t.id))
      .forEach((t) => closeTab(t.id))
  }
  const closeAll = () => {
    sortedTabs.filter((t) => !pinnedIds.has(t.id)).forEach((t) => closeTab(t.id))
  }
  const copyPath = async (tab: EditorTab) => {
    try {
      await navigator.clipboard.writeText(tab.path)
    } catch {
      /* 剪贴板不可用时静默忽略 */
    }
  }

  const handleDragStart = (id: string) => () => setDragId(id)
  const handleDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault()
    if (overId !== id) setOverId(id)
  }
  const handleDrop = (id: string) => (e: React.DragEvent) => {
    e.preventDefault()
    if (dragId && dragId !== id) {
      setOrder((prev) => {
        const from = prev.indexOf(dragId)
        const to = prev.indexOf(id)
        if (from === -1 || to === -1) return prev
        const next = [...prev]
        next.splice(from, 1)
        next.splice(to, 0, dragId)
        return next
      })
    }
    setDragId(null)
    setOverId(null)
  }
  const handleDragEnd = () => {
    setDragId(null)
    setOverId(null)
  }

  return (
    <div className="relative flex h-8 shrink-0 items-stretch overflow-x-auto bg-muted/20">
      {sortedTabs.map((tab) => {
        const Icon = getFileIcon(tab.filename)
        const isActive = activeTabId === tab.id
        const isPinned = pinnedIds.has(tab.id)
        return (
          <div
            key={tab.id}
            draggable
            onDragStart={handleDragStart(tab.id)}
            onDragOver={handleDragOver(tab.id)}
            onDrop={handleDrop(tab.id)}
            onDragEnd={handleDragEnd}
            onClick={() => setActiveTab(tab.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu({ x: e.clientX, y: e.clientY, tabId: tab.id })
            }}
            style={{ width: `${calcTabWidth(tab.filename)}px` }}
            className={cn(
              'group relative flex shrink-0 cursor-pointer items-center gap-1.5 px-3 text-xs transition-colors',
              isActive
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:bg-muted/40',
              overId === tab.id && dragId && dragId !== tab.id && 'bg-muted/60',
              dragId === tab.id && 'opacity-50',
            )}
          >
            {isPinned ? (
              <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <Icon className={cn('h-3.5 w-3.5 shrink-0', getFileColor(tab.filename))} />
            )}
            <span className="min-w-0 flex-1 truncate">{tab.filename}</span>
            {isPinned ? null : tab.isDirty ? (
              <Circle className="h-2 w-2 shrink-0 fill-current opacity-60" />
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                className="rounded-sm opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                aria-label="关闭标签"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </div>
        )
      })}
      {menu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover py-1 text-xs shadow-md"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {(() => {
            const tab = openTabs.find((t) => t.id === menu.tabId)
            if (!tab) return null
            const isPinned = pinnedIds.has(tab.id)
            return (
              <>
                <MenuItem icon={Pin} onClick={() => { togglePin(tab.id); setMenu(null) }}>
                  {isPinned ? '取消固定' : '固定标签'}
                </MenuItem>
                <MenuItem icon={X} onClick={() => { closeTab(tab.id); setMenu(null) }}>
                  关闭
                </MenuItem>
                <MenuItem icon={XCircle} onClick={() => { closeOthers(tab.id); setMenu(null) }}>
                  关闭其他
                </MenuItem>
                <MenuItem icon={Files} onClick={() => { closeAll(); setMenu(null) }}>
                  关闭全部
                </MenuItem>
                <MenuItem icon={Copy} onClick={() => { void copyPath(tab); setMenu(null) }}>
                  复制路径
                </MenuItem>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  children,
  onClick,
  icon: Icon,
}: {
  children: React.ReactNode
  onClick: () => void
  icon: typeof X
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </button>
  )
}
