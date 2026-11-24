// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

/**
 * 滚动视口边缘淡出遮罩(通用,多端一致的「边缘渐变覆盖层」方案的 Web 实现)
 *
 * 贴在可滚动容器的**顶部与底部**:内容滑动到边缘时,列表项先溶解进背景,不再硬切。
 * 仅在确有溢出时显现 —— 顶部:已向下滚动(上方有被藏起的内容);底部:视口底没到内容底。
 * 静止顶/底时不显示,故不会淡掉静止态的首/尾项。
 *
 * 多端一致规格(2026-11-10 定档,web / mobile-rn / miniapp-taro 三端同参数):
 * ① 纯线性渐变:边缘实底 → 内侧完全透明,**无实底平台**(旧 56px/90px 带平台方案已废弃);
 * ② 高度 24px:只影响贴边一小条,不吃一整行内容;
 * ③ 仅溢出方向显示;pointer-events 穿透,不挡滚动与点击;
 * ④ 色值用所在区域背景令牌(RN/小程序端用同值实色渐变,三端观感一致)。
 *
 * 透明端用 `color-mix(in srgb, ... 0%, transparent)` 而不是 `transparent` 关键字 ——
 * 后者是 `rgba(0,0,0,0)`,与背景色插值时会产生灰带。
 * 注意:`--color-background` 本身已是 hsl(...) 值,外层不得再包 hsl(),
 * 否则 `hsl(hsl(...))` 非法被浏览器静默丢弃 ⇒ 渐变失效(2026-10-29 教训,
 * 详见守门 `scripts/check-input-border-var.mjs`)。
 *
 * 锚点:本组件是父级 `relative` 包裹层的子节点,绝对定位于滚动视口的上/下边缘,
 * **不随内容滚动**(滚动由 scrollRef 指向的元素自身 overflow-y-auto 承担)。
 */

const DEFAULT_FADE_HEIGHT_PX = 24

export interface ScrollEdgeFadesProps {
  /** 可滚动元素的 ref(用于监听 scroll / 计算溢出) */
  scrollRef: React.RefObject<HTMLElement | null>
  /** 淡出条高度,默认 24px(多端一致规格,非必要不要改) */
  heightPx?: number
  /** 遮罩色(实底端),默认页面背景令牌;所在区域背景不同(如 bg-card)时显式传入 */
  color?: string
}

export function ScrollEdgeFades({
  scrollRef,
  heightPx = DEFAULT_FADE_HEIGHT_PX,
  color = 'var(--color-background)',
}: ScrollEdgeFadesProps) {
  const [topVisible, setTopVisible] = React.useState(false)
  const [bottomVisible, setBottomVisible] = React.useState(false)

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const update = () => {
      // 顶部:已向下滚动(上方有被藏起的内容)才显示
      setTopVisible(el.scrollTop > 1)
      // 底部:视口底没到内容底(下方还有内容)才显示
      setBottomVisible(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
      // 内容首子节点可能被整体替换(空态↔列表切换),RO 只认元素引用,每轮补挂当前首子
      if (el.firstElementChild) ro.observe(el.firstElementChild)
    }
    // rAF 去抖:滚动帧/流式高频 DOM 变化合并到每帧一次(读 3 个数字,显隐不变则 setState bail)
    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        update()
      })
    }
    // 溢出判据依赖 scrollHeight,而 scrollHeight 变化有三条互不覆盖的来源:
    // ① 容器自身尺寸变化(窗口/面板拖宽)⇒ RO(el);
    // ② 内容高度变化但不增删 DOM(流式逐 token 撑高消息)⇒ RO(内容首子节点)
    //    (聊天滚动容器的首子是稳定的内层包裹 div,高度随内容变;RO 同元素重复 observe 为 no-op);
    // ③ DOM 增删(展开分组 / 历史加载 / 虚拟窗口化换页)但容器与首子未必即时变化 ⇒ MO childList。
    // 旧实现只挂 RO(el),漏掉 ②③ ⇒ 侧栏展开分组、聊天加载历史后遮罩不重算(2026-11-10 根治)。
    const ro = new ResizeObserver(schedule)
    ro.observe(el)
    const mo = new MutationObserver(schedule)
    mo.observe(el, { childList: true, subtree: true })
    // 先挂 observer 再首算(update 内会补挂首子节点到 ro,声明顺序颠倒会踩 ro 的 TDZ)
    update()
    el.addEventListener('scroll', schedule, { passive: true })
    return () => {
      el.removeEventListener('scroll', schedule)
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
    }
  }, [scrollRef])

  return (
    <>
      {/* 顶部淡出:上边缘实底 → 向下透明,内容上滑时先溶进背景 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 transition-opacity duration-150"
        style={{
          height: `${heightPx}px`,
          opacity: topVisible ? 1 : 0,
          backgroundImage: `linear-gradient(to bottom, ${color} 0%, color-mix(in srgb, ${color} 0%, transparent) 100%)`,
        }}
      />
      {/* 底部淡出:下边缘实底 → 向上透明,内容下滑时先溶进背景 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 transition-opacity duration-150"
        style={{
          height: `${heightPx}px`,
          opacity: bottomVisible ? 1 : 0,
          backgroundImage: `linear-gradient(to top, ${color} 0%, color-mix(in srgb, ${color} 0%, transparent) 100%)`,
        }}
      />
    </>
  )
}

export default ScrollEdgeFades
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
