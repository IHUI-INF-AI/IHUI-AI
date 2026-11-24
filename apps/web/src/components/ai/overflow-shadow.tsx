// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

/**
 * G-827 —— 横向溢出容器要有**方向阴影**提示(左右各一条,只看真实滚动位置)。
 *
 * 立因:`overflow-x-auto` 在本仓此前没有任何溢出线索 —— 移动端尤其致命:
 * 一张宽表/长代码行被右边缘裁掉,用户看不出"还能往右拉"。上游参考
 * `markdown-table.tsx:705-733`(四态 none/left/right/both)+ `:1323-1347`
 * (inset 阴影 + `pointer-events-none` + `aria-hidden`)。
 *
 * **为什么必须是显式 inset 阴影,而不是渐变遮罩**:AGENTS §4「禁止渐变遮罩」
 * 明令容器不得用 `mask-image` / `linear-gradient` 做边缘淡出(守门 11g 会把它们
 * 判红)。本组件的阴影是 `box-shadow: inset` 的实体边,不是遮罩,与禁令零冲突;
 * 两侧各用绝对定位的覆盖层承载,`pointer-events-none` 保证不吞滚动/点击,
 * `aria-hidden` 保证不给读屏器添噪音。左阴影只在**真实 `scrollLeft > 阈值`**时
 * 出现(拉到最左就不再提示左侧),右阴影只在"未到最右"时出现 —— 与上游同判据。
 *
 * 用法:把横滚容器包进本组件;本组件用 ResizeObserver + scroll 事件同步四态。
 * 未溢出(内容不宽于视口)时两态皆 false ⇒ 一条阴影都不渲染(票面验收第一条)。
 */

/** 判定"已滚到最左/最右"的容差(px)。亚像素布局/缩放会产生 0.5~1 的假差,取 1。 */
const EDGE_EPSILON = 1

export type OverflowEdges = { left: boolean; right: boolean }

/**
 * 由元素当前滚动状态算出四态中的两轴(纯函数,便于单测把判据钉死)。
 * 纯函数化的理由与本仓既有做法一致:把"什么算溢出"的判据从 DOM 事件里摘出来,
 * 测试可直接喂 { scrollLeft, scrollWidth, clientWidth } 断言,不必真跑布局。
 */
export function computeOverflowEdges(input: {
  scrollLeft: number
  scrollWidth: number
  clientWidth: number
}): OverflowEdges {
  const { scrollLeft, scrollWidth, clientWidth } = input
  const canScroll = scrollWidth - clientWidth > EDGE_EPSILON
  if (!canScroll) return { left: false, right: false }
  return {
    left: scrollLeft > EDGE_EPSILON,
    right: scrollLeft < scrollWidth - clientWidth - EDGE_EPSILON,
  }
}

/** 四态字符串(与上游 none/left/right/both 同形,便于按单值断言)。 */
export function overflowEdgeState(edges: OverflowEdges): 'none' | 'left' | 'right' | 'both' {
  if (edges.left && edges.right) return 'both'
  if (edges.left) return 'left'
  if (edges.right) return 'right'
  return 'none'
}

export interface OverflowShadowProps {
  children: React.ReactNode
  className?: string
  /** 数据属性前缀(默认 overflow-shadow),测试与祖先选择器据此定位 */
  testId?: string
}

export function OverflowShadow({ children, className, testId = 'overflow-shadow' }: OverflowShadowProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const [edges, setEdges] = React.useState<OverflowEdges>({ left: false, right: false })

  const sync = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const next = computeOverflowEdges({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    })
    setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next))
  }, [])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    // 容器/内容尺寸变化时要重算(内容异步渲染 / 字体加载 / 窗口缩放)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => sync())
      ro.observe(el)
      // 内容子节点尺寸变化也要重算:观察第一个子元素(本容器约定单子),没有则跳过
      if (el.firstElementChild) ro.observe(el.firstElementChild)
    }
    window.addEventListener('resize', sync)
    return () => {
      el.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      ro?.disconnect()
    }
  }, [sync])

  const state = overflowEdgeState(edges)

  return (
    <div className={['relative', className].filter(Boolean).join(' ')} data-overflow-shadow={state}>
      <div ref={scrollRef} className="overflow-x-auto">
        {children}
      </div>
      {/* 左向线索:真实 scrollLeft > 0 才出现。inset 阴影实体边,不是渐变遮罩(AGENTS §4) */}
      {edges.left && (
        <div
          data-testid={`${testId}-left`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-3"
          style={{ boxShadow: 'inset 8px 0 8px -8px rgba(0,0,0,0.35)' }}
        />
      )}
      {/* 右向线索:未到最右才出现 */}
      {edges.right && (
        <div
          data-testid={`${testId}-right`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-3"
          style={{ boxShadow: 'inset -8px 0 8px -8px rgba(0,0,0,0.35)' }}
        />
      )}
    </div>
  )
}
