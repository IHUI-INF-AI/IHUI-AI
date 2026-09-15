// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import {
  computePortalPanelCoords,
  type PortalPanelAnchor,
  type PortalPanelCoords,
} from '@/lib/portal-panel-position'

/**
 * 全项目浮层统一定位 hook(2026-09-15 立)。
 *
 * 项目内所有"portal 到 body + fixed 定位"的浮层,统一走这一个 hook,
 * 不再各自手写 getBoundingClientRect 坐标 + rAF + resize/scroll 监听 +
 * ResizeObserver(此前重复实现约 10 份,见各组件历史注释)。
 *
 * 职责:
 * 1. open 时先渲染一次(藏屏外)→ rAF 测量面板尺寸 → 写入坐标;
 * 2. window resize / 任意祖先 scroll(capture)→ rAF 节流重算;
 * 3. ResizeObserver 观察面板与锚点尺寸变化(内容增减、trigger 变形)→ 重算。
 *
 * 坐标策略由 lib/portal-panel-position.ts 的 computePortalPanelCoords 提供:
 * 首选侧 → 放不下自动翻转 → 两侧都放不下选大侧并 maxHeight 收敛 + 视口 clamp。
 *
 * 一般不需要直接用本 hook:直接用 <PortalPanel>(components/feedback/portal-panel.tsx)
 * 即可同时获得定位 + Escape/外点关闭。仅当面板结构特殊(如需复用外部已有 ref)
 * 时才单独使用本 hook。
 */
export interface UsePortalPanelPositionArgs {
  /** 锚点(触发器)元素 ref;同时容纳 HTML 与 SVG 锚点(SVGElement 不继承 HTMLElement) */
  anchorRef: React.RefObject<Element | null>
  /** 面板容器元素 ref(组件内部持有,传给本 hook 做测量) */
  panelRef: React.RefObject<HTMLElement | null>
  /** 浮层打开状态 */
  open: boolean
  /** 首选停靠侧 + 间距 + 水平对齐 */
  anchor: PortalPanelAnchor
}

/** 返回 fixed 坐标;null = 面板尺寸未测得(首帧),调用方应把面板藏到屏幕外 */
export function usePortalPanelPosition({
  anchorRef,
  panelRef,
  open,
  anchor,
}: UsePortalPanelPositionArgs): PortalPanelCoords | null {
  const { side, align, gap } = anchor
  const [coords, setCoords] = React.useState<PortalPanelCoords | null>(null)

  // 锚点元素可能被调用方动态替换(如 hover 在多个 SVG 节点间切换)→ 每次 render 后
  // 同步;元素身份变化触发 state 更新 → update/RO 依赖变化 → 自动重测坐标。
  const [anchorEl, setAnchorEl] = React.useState<Element | null>(() => anchorRef.current)
  React.useEffect(() => {
    if (anchorRef.current !== anchorEl) setAnchorEl(anchorRef.current)
  })

  const update = React.useCallback(() => {
    const panelEl = panelRef.current
    if (!anchorEl || !panelEl) return
    const next = computePortalPanelCoords(
      anchorEl.getBoundingClientRect(),
      panelEl.getBoundingClientRect(),
      { side, align, gap },
    )
    if (next) setCoords(next)
  }, [anchorEl, panelRef, side, align, gap])

  // open 变化 / 视口布局事件 → rAF 节流重算
  React.useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    schedule()
    window.addEventListener('resize', schedule, { passive: true })
    window.addEventListener('scroll', schedule, { capture: true, passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [open, update])

  // 面板/锚点自身尺寸变化(内容增减、trigger 变形)→ 重算
  React.useEffect(() => {
    if (!open || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    if (panelRef.current) observer.observe(panelRef.current)
    if (anchorEl) observer.observe(anchorEl)
    return () => observer.disconnect()
  }, [open, update, anchorEl, panelRef])

  return coords
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
