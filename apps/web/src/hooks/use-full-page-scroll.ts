'use client'

import * as React from 'react'

export interface UseFullPageScrollReturn {
  /** 当前页索引(0-based) */
  section: number
  /** 总页数 */
  total: number
  /** 设置总页数 */
  setTotal: (n: number) => void
  /** 跳转到指定页(0-based) */
  scrollTo: (index: number) => void
  /** 下一页 */
  next: () => void
  /** 上一页 */
  prev: () => void
}

/**
 * 首页全屏分页滚动 Hook
 * - 监听 wheel / touchstart / keydown 触发翻页
 * - 通过 scroll-snap + scrollIntoView 实现平滑滚动
 * - 节流锁避免连续触发
 * - SSR 安全(hydration 期间不绑定事件)
 *
 * 使用方式:
 *   const { section, total, setTotal, scrollTo } = useFullPageScroll(5)
 *   // 容器: className="snap-y snap-mandatory h-screen overflow-y-scroll"
 *   // 子页: className="snap-start h-screen"
 *   <PageIndicator current={section} total={total} onClick={scrollTo} />
 */
export function useFullPageScroll(initialTotal = 0): UseFullPageScrollReturn {
  const [section, setSection] = React.useState(0)
  const [total, setTotal] = React.useState(initialTotal)
  const lockRef = React.useRef(false)
  const touchStartY = React.useRef<number | null>(null)

  const scrollTo = React.useCallback(
    (index: number) => {
      const target = Math.max(0, Math.min(index, total - 1))
      if (target === section) return
      setSection(target)
      // 同步滚动到目标 section(由 page.tsx 容器实现 scroll-snap)
      if (typeof document !== 'undefined') {
        const el = document.getElementById(`home-page-${target + 1}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    },
    [section, total],
  )

  const next = React.useCallback(() => scrollTo(section + 1), [scrollTo, section])
  const prev = React.useCallback(() => scrollTo(section - 1), [scrollTo, section])

  /**
   * 触发翻页并加锁,避免连续触发
   * @param direction 'next' | 'prev'
   */
  const triggerPage = React.useCallback(
    (direction: 'next' | 'prev') => {
      if (lockRef.current) return
      lockRef.current = true
      if (direction === 'next') next()
      else prev()
      window.setTimeout(() => {
        lockRef.current = false
      }, 900)
    },
    [next, prev],
  )

  // 监听滚轮事件实现全屏翻页(带节流锁)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 30) return
      e.preventDefault()
      triggerPage(e.deltaY > 0 ? 'next' : 'prev')
    }
    // 监听容器而非 window,避免与页面其他滚动冲突
    const container = document.getElementById('home-scroll-container')
    if (!container) return
    container.addEventListener('wheel', handler, { passive: false })
    return () => container.removeEventListener('wheel', handler)
  }, [triggerPage])

  // 监听触摸事件(移动端)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const container = document.getElementById('home-scroll-container')
    if (!container) return

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0]?.clientY ?? null
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartY.current === null) return
      const endY = e.changedTouches[0]?.clientY ?? touchStartY.current
      const delta = touchStartY.current - endY
      if (Math.abs(delta) < 50) return
      triggerPage(delta > 0 ? 'next' : 'prev')
      touchStartY.current = null
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchend', onTouchEnd)
    }
  }, [triggerPage])

  // 监听键盘事件(PageDown/PageUp/箭头)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'PageDown' || e.key === 'ArrowDown') {
        e.preventDefault()
        triggerPage('next')
      } else if (e.key === 'PageUp' || e.key === 'ArrowUp') {
        e.preventDefault()
        triggerPage('prev')
      } else if (e.key === 'Home') {
        e.preventDefault()
        scrollTo(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        scrollTo(total - 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [triggerPage, scrollTo, total])

  // 禁用浏览器自动恢复滚动位置
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  return { section, total, setTotal, scrollTo, next, prev }
}
