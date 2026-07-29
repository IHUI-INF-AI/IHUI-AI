'use client'

import * as React from 'react'

export type ContextMenuAction =
  | 'copy'
  | 'copyMarkdown'
  | 'regenerate'
  | 'feedback'
  | 'share'
  | 'collapseToPlan'
  | 'delete'
  | 'search'

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

interface UseContextMenuOptions<T> {
  buildItems?: (data: T) => ContextMenuItem[]
}

interface UseContextMenuReturn<T> {
  visible: boolean
  position: { x: number; y: number }
  items: ContextMenuItem[]
  data: T | null
  contextMenuHandlers: { onContextMenu: (e: React.MouseEvent) => void }
  close: () => void
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
    return []
  }, [data, buildItems])

  const onContextMenu = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setPosition({ x: e.clientX, y: e.clientY })
    setVisible(true)
  }, [])

  return {
    visible,
    position,
    items,
    data,
    contextMenuHandlers: { onContextMenu },
    close,
    setData,
  }
}
