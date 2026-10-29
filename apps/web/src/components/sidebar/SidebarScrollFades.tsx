// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

/**
 * 侧边栏菜单滚动淡出(Web 端,与 RN mobile-rn / miniapp 底部淡出同感的「无硬边过渡」)
 *
 * 贴在可滚动菜单区的**顶部与底部**:菜单上下滑动到边缘时,列表项先溶解进背景,不再硬切。
 * 仅在确有溢出时显现 —— 顶部:已向下滚动(上方有被藏起的内容);底部:视口底没到内容底。
 * 静止顶/底时不显示,故不会淡掉静止态的首/尾项。
 *
 * 色值直接引用 tokens.css 的 `--color-background`(单一真相源,`@theme` 已序列化为 hsl 值),
 * 透明端用 `color-mix(in srgb, ... 0%, transparent)` 而不是 `transparent` 关键字 ——
 * 后者是 `rgba(0,0,0,0)`,与背景色插值时会产生灰带。
 *
 * 2026-10-29 修复:原写法 `hsl(var(--background) / a)` 有两处硬错 ——
 * ① `--background` 全仓从未定义(正确令牌名是 `--color-background`);
 * ② 即便定义了,`--color-background` 本身就已是 `hsl(...)` 值,Tailwind v4 下外层再包 hsl()
 *    会变成 `hsl(hsl(...))` 非法值被浏览器静默丢弃 ⇒ 整个渐变失效、淡出遮罩完全不显示。
 *    详见守门 `scripts/check-input-border-var.mjs`。
 *
 * 锚点:本组件是 `relative` 包裹层的子节点,绝对定位于菜单滚动视口的上/下边缘,**不随内容滚动**
 * (滚动由 nav 自身 overflow-y-auto 承担),故淡出始终钉在视口边缘。
 */

const FADE_HEIGHT_PX = 56

export interface SidebarScrollFadesProps {
  /** 可滚动菜单 nav 的 ref(用于监听 scroll / 计算溢出) */
  navRef: React.RefObject<HTMLElement | null>
}

export default function SidebarScrollFades({ navRef }: SidebarScrollFadesProps) {
  const [topVisible, setTopVisible] = React.useState(false)
  const [bottomVisible, setBottomVisible] = React.useState(false)

  React.useEffect(() => {
    const el = navRef.current
    if (!el) return
    const update = () => {
      // 顶部:已向下滚动(上方有被藏起的内容)才显示
      setTopVisible(el.scrollTop > 1)
      // 底部:视口底没到内容底(下方还有内容)才显示
      setBottomVisible(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    // 内容高度变化(展开分组 / 登录态切换 / 列表增减)也要重算
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [navRef])

  return (
    <>
      {/* 顶部淡出:上边缘实底 → 向下透明,菜单上滑时先溶进背景 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 transition-opacity duration-150"
        style={{
          height: `${FADE_HEIGHT_PX}px`,
          opacity: topVisible ? 1 : 0,
          backgroundImage:
            'linear-gradient(to bottom, var(--color-background) 0%, var(--color-background) 50%, color-mix(in srgb, var(--color-background) 0%, transparent) 100%)',
        }}
      />
      {/* 底部淡出:下边缘实底 → 向上透明,菜单下滑时先溶进背景 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 transition-opacity duration-150"
        style={{
          height: `${FADE_HEIGHT_PX}px`,
          opacity: bottomVisible ? 1 : 0,
          backgroundImage:
            'linear-gradient(to top, var(--color-background) 0%, var(--color-background) 50%, color-mix(in srgb, var(--color-background) 0%, transparent) 100%)',
        }}
      />
    </>
  )
}
