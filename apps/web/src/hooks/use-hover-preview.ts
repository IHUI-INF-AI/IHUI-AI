'use client'

import * as React from 'react'

/**
 * useHoverPreview — Hover 预览状态管理 hook(2026-07-28 立,Trae Work 对齐)
 *
 * 设计目标:
 * - 提供 hover 预览的延迟显示(默认 250ms)/ 延迟关闭(100ms)/ 边界检测
 * - 与 HoverPreviewCard 组件配合使用
 * - 同时支持 mouse 和 focus 触发(键盘可达)
 *
 * 使用模式:
 * - anchorRef:触发 hover 的元素引用(用于边界检测和位置计算)
 * - data:预览内容数据(若 null 则不显示)
 * - buildContent:根据 data 构建 React.ReactNode
 */

interface UseHoverPreviewOptions<T> {
  buildContent: (data: T) => React.ReactNode
  anchorRef: React.RefObject<HTMLElement>
  data: T | null
  delayMs?: number
  closeDelayMs?: number
  offsetX?: number
  offsetY?: number
}

interface HoverPreviewGeometry {
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
      if (visible) return
      const anchor = anchorRef.current
      let x = 0
      let y = 0
      if (anchor) {
        const rect = anchor.getBoundingClientRect()
        x = rect.right + offsetX
        y = rect.top + offsetY
        // 边界检测:超出视口右/下时翻转
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
      setPosition({ x, y })
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
