'use client'

import * as React from 'react'

interface UseHoverPreviewOptions<T> {
  buildContent: (data: T) => React.ReactNode
  anchorRef: React.RefObject<HTMLElement | null>
  data: T | null
  delayMs?: number
  closeDelayMs?: number
  offsetX?: number
  offsetY?: number
}

export interface HoverPreviewGeometry {
  visible: boolean
  position: { x: number; y: number }
  content: React.ReactNode
  hoverHandlers: {
    onMouseEnter: (e: React.MouseEvent) => void
    onMouseLeave: (e: React.MouseEvent) => void
    onFocus: (e: React.FocusEvent) => void
    onBlur: (e: React.FocusEvent) => void
  }
  close: () => void
}

export function useHoverPreview<T>({
  buildContent,
  anchorRef,
  data,
  delayMs = 250,
  closeDelayMs = 100,
  offsetX = 8,
  offsetY = 8,
}: UseHoverPreviewOptions<T>): HoverPreviewGeometry {
  const [visible, setVisible] = React.useState(false)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const dataRef = React.useRef(data)
  dataRef.current = data

  const showTimerRef = React.useRef<number | null>(null)
  const closeTimerRef = React.useRef<number | null>(null)

  const clearTimers = React.useCallback(() => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const close = React.useCallback(() => {
    clearTimers()
    setVisible(false)
  }, [clearTimers])

  const show = React.useCallback(
    (e: React.MouseEvent | React.FocusEvent) => {
      if (!dataRef.current) return
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      const anchor = anchorRef.current
      let x = 0
      let y = 0
      if (anchor) {
        const rect = anchor.getBoundingClientRect()
        x = rect.right + offsetX
        y = rect.top + offsetY
        if (typeof window !== 'undefined') {
          const vw = window.innerWidth
          const vh = window.innerHeight
          if (x + 240 > vw) x = Math.max(8, rect.left - 240 - offsetX)
          if (y + 140 > vh) y = Math.max(8, vh - 140 - 8)
        }
      } else if ('clientX' in e) {
        x = e.clientX + offsetX
        y = e.clientY + offsetY
      }
      // 2026-08-02 修复:即使 visible 也重新计算 position
      // (anchor 可能因滚动/布局变化移动了位置)
      setPosition({ x, y })
      if (visible) return
      showTimerRef.current = window.setTimeout(() => {
        setVisible(true)
        showTimerRef.current = null
      }, delayMs)
    },
    [anchorRef, delayMs, offsetX, offsetY, visible],
  )

  const hide = React.useCallback(() => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    closeTimerRef.current = window.setTimeout(() => {
      setVisible(false)
      closeTimerRef.current = null
    }, closeDelayMs)
  }, [closeDelayMs])

  React.useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  React.useEffect(() => {
    if (data === null) close()
  }, [data, close])

  return {
    visible,
    position,
    content: data ? buildContent(data) : null,
    hoverHandlers: {
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
    },
    close,
  }
}
