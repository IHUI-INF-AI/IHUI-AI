// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * - 监听 wheel / touchstart / 键盘(PageUp/PageDown)触发翻页
 * - 通过 scroll-snap + scrollIntoView 实现平滑滚动
 * - 节流锁避免连续触发
 * - SSR 安全(hydration 期间不绑定事件)
 *
 * 键位归属(2026-09-22 立,详见下方键盘 effect 注释):
 * 整屏翻页只吃 PageUp/PageDown,↑/↓/Home/End 一律让给对话流消息导航。
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

  // 监听键盘事件(PageUp/PageDown)
  // 2026-09-22 键位归属改版:此前 ↑/↓/Home/End 也在这里 preventDefault 翻页,而
  // use-message-list-scroll 用同一组键切换"聚焦消息"。/chat 复用本首页组件
  // (app/(main)/chat/page.tsx 渲染 WorkAreaHomePage),两套 window keydown 同时生效 ⇒
  // 一次按键既整屏翻页又跳消息焦点;焦点在输入框时方向键还被整屏吞掉(无法移光标)。
  // 现定:方向键与首尾键归对话流,整屏翻页只保留 PageUp/PageDown(滚轮/触摸/分页指示器不变)。
  // 焦点在可编辑元素内、或带 meta/ctrl/alt 修饰时全部放行,交还原生行为。
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      if (e.key === 'PageDown') {
        e.preventDefault()
        triggerPage('next')
      } else if (e.key === 'PageUp') {
        e.preventDefault()
        triggerPage('prev')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [triggerPage])

  // 禁用浏览器自动恢复滚动位置
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('scrollRestoration' in window.history)) return
    // 2026-08-02 修复: scrollRestoration 未恢复 - cleanup 中恢复原值
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previous
    }
  }, [])

  return { section, total, setTotal, scrollTo, next, prev }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
