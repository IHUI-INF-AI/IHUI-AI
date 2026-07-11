'use client'

import * as React from 'react'

export interface FloatingChatState {
  open: boolean
  minimized: boolean
  position: { x: number; y: number }
}

export interface UseFloatingChatReturn extends FloatingChatState {
  openChat: () => void
  closeChat: () => void
  toggleOpen: () => void
  toggleMinimize: () => void
  setPosition: (pos: { x: number; y: number }) => void
  dragStart: (e: React.PointerEvent) => void
}

const DEFAULT_POSITION = { x: 0, y: 0 }

/** 浮动聊天增强 Hook，维护展开/最小化状态与拖拽位置 */
export function useFloatingChat(): UseFloatingChatReturn {
  const [open, setOpen] = React.useState(false)
  const [minimized, setMinimized] = React.useState(false)
  const [position, setPosition] = React.useState<{ x: number; y: number }>(DEFAULT_POSITION)
  const dragOffsetRef = React.useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })

  const dragStart = React.useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    dragOffsetRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    }
    target.setPointerCapture(e.pointerId)
  }, [])

  React.useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (e.buttons !== 1) return
      setPosition({
        x: e.clientX - dragOffsetRef.current.dx,
        y: e.clientY - dragOffsetRef.current.dy,
      })
    }
    window.addEventListener('pointermove', handleMove)
    return () => window.removeEventListener('pointermove', handleMove)
  }, [])

  return {
    open,
    minimized,
    position,
    openChat: () => setOpen(true),
    closeChat: () => setOpen(false),
    toggleOpen: () => setOpen((o) => !o),
    toggleMinimize: () => setMinimized((m) => !m),
    setPosition,
    dragStart,
  }
}
