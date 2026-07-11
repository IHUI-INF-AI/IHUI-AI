'use client'

import * as React from 'react'

export interface UseFullPageScrollReturn {
  section: number
  total: number
  setTotal: (n: number) => void
  scrollTo: (index: number) => void
  next: () => void
  prev: () => void
}

/** 首页全屏滚动 Hook，管理当前屏索引与滚动方向 */
export function useFullPageScroll(initialTotal = 0): UseFullPageScrollReturn {
  const [section, setSection] = React.useState(0)
  const [total, setTotal] = React.useState(initialTotal)
  const lockRef = React.useRef(false)

  const scrollTo = React.useCallback(
    (index: number) => {
      const target = Math.max(0, Math.min(index, total - 1))
      if (target === section) return
      setSection(target)
    },
    [section, total],
  )

  const next = React.useCallback(() => scrollTo(section + 1), [scrollTo, section])
  const prev = React.useCallback(() => scrollTo(section - 1), [scrollTo, section])

  // 监听滚轮事件实现全屏翻页（带节流锁）
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (e: WheelEvent) => {
      if (lockRef.current) return
      if (Math.abs(e.deltaY) < 30) return
      lockRef.current = true
      if (e.deltaY > 0) next()
      else prev()
      window.setTimeout(() => {
        lockRef.current = false
      }, 800)
    }
    window.addEventListener('wheel', handler, { passive: true })
    return () => window.removeEventListener('wheel', handler)
  }, [next, prev])

  return { section, total, setTotal, scrollTo, next, prev }
}
