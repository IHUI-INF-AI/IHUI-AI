'use client'

import * as React from 'react'

export interface UseScrollPositionReturn {
  x: number
  y: number
}

/** 监听窗口滚动位置 */
export function useScrollPosition(): UseScrollPositionReturn {
  const [pos, setPos] = React.useState({ x: 0, y: 0 })

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => {
      setPos({ x: window.scrollX, y: window.scrollY })
    }
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return pos
}

export interface UseScrollToTopReturn {
  scrollToTop: () => void
  isScrolled: boolean
}

/** 滚动到顶部 + 判断是否已滚动超过阈值 */
export function useScrollToTop(threshold = 400): UseScrollToTopReturn {
  const [isScrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => {
      setScrolled(window.scrollY > threshold)
    }
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [threshold])

  const scrollToTop = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  return { scrollToTop, isScrolled }
}
