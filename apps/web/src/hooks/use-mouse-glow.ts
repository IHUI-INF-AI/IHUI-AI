'use client'

import * as React from 'react'

export interface UseMouseGlowReturn {
  /** 是否启用光效 */
  enabled: boolean
  /** 当前鼠标位置（相对视口） */
  position: { x: number; y: number }
  /** 光效跟随的目标元素 ref */
  targetRef: React.RefObject<HTMLElement | null>
  enable: () => void
  disable: () => void
  toggle: () => void
}

/** 鼠标光效 Hook，监听 mousemove 并更新 CSS 变量供渐变光效消费 */
export function useMouseGlow(): UseMouseGlowReturn {
  const targetRef = React.useRef<HTMLElement | null>(null)
  const [enabled, setEnabled] = React.useState(true)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })

  React.useEffect(() => {
    if (!enabled) return
    const handleMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY })
      const el = targetRef.current ?? document.documentElement
      el.style.setProperty('--glow-x', `${e.clientX}px`)
      el.style.setProperty('--glow-y', `${e.clientY}px`)
    }
    window.addEventListener('mousemove', handleMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMove)
  }, [enabled])

  return {
    enabled,
    position,
    targetRef,
    enable: () => setEnabled(true),
    disable: () => setEnabled(false),
    toggle: () => setEnabled((v) => !v),
  }
}
