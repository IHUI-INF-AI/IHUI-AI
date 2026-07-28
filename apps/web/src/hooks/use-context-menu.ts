'use client'

/**
 * useContextMenu — 右键菜单状态管理 hook(Phase 19.4,2026-07-28 立)
 *
 * 返回:visible / position / items / data / contextMenuHandlers / close / setData
 */

import * as React from 'react'
import {
  defaultMessageMenuItems,
  type ContextMenuItem,
} from '@/components/ai/message-context-menu'

interface UseContextMenuOptions<T> {
  buildItems?: (data: T) => ContextMenuItem[]
  onItemClick?: (item: ContextMenuItem, data: T) => void
}

interface UseContextMenuReturn<T> {
  visible: boolean
  position: { x: number; y: number }
  items: ContextMenuItem[]
  data: T | null
  contextMenuHandlers: { onContextMenu: (e: React.MouseEvent) => void }
  close: () => void
  currentData: T | null
  setData: (data: T | null) => void
}

export function useContextMenu<T>({
  buildItems,
}: UseContextMenuOptions<T> = {}): UseContextMenuReturn<T> {
  const [visible, setVisible] = React.useState(false)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const [data, setData] = React.useState<T | null>(null)

  const close = React.useCallback(() => {
    setVisible(false)
    setData(null)
  }, [])

  const items = React.useMemo<ContextMenuItem[]>(() => {
    if (!data) return []
    if (buildItems) return buildItems(data)
    if (data && typeof data === 'object' && 'content' in data && 'id' in data) {
      return defaultMessageMenuItems(data as { id: string; content: string })
    }
    return []
  }, [data, buildItems])

  const onContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const x = e.clientX
      const y = e.clientY
      setPosition({ x, y })
      setVisible(true)
    },
    [],
  )

  return {
    visible,
    position,
    items,
    data,
    contextMenuHandlers: { onContextMenu },
    close,
    currentData: data,
    setData,
  }
}

export default useContextMenu
