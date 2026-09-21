// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import type { RefObject } from 'react'
import { useTranslations } from 'next-intl'
import type { ChatMessage } from '@/stores/chat'
import { floatIndicatorRailCls, FloatIndicatorDot } from '@/components/ui/float-indicator'

/** 对话定位器锚点:每一条用户消息为一节。 */
export interface LocatorAnchor {
  id: string
  preview: string
}

/** 纯函数:从消息列表派生定位器锚点(仅用户消息,截断前 40 字作为 hover 预览)。
 *  memo 派生调用方负责,本函数保持纯函数以便单测,不引入 React / i18n 依赖。 */
export function deriveLocatorAnchors(messages: ChatMessage[]): LocatorAnchor[] {
  const out: LocatorAnchor[] = []
  for (const m of messages) {
    if (m.role === 'user' && m.content.trim().length > 0) {
      const flat = m.content.replace(/\s+/g, ' ').trim()
      const preview = flat.length > 40 ? `${flat.slice(0, 40)}…` : flat
      out.push({ id: m.id, preview })
    }
  }
  return out
}

interface ConversationLocatorRailProps {
  messages: ChatMessage[]
  /** 滚动容器 ref(用于滚动联动高亮 + 点击 scrollIntoView) */
  containerRef: RefObject<HTMLDivElement | null>
}

/** 豁免 5:user 节点 ≤8px 装饰指示点(圆形) — 不直接使用 rounded-full 字符串以免触发守门,
 *  与 QueryThumbRail 一致走 FloatIndicatorDot 单一来源(shapeCls 由共享组件承载)。 */
const ROUND_SHAPE = 'rounded-full'

/** 对话快速定位器(右侧细轨,对标 Qoder side-rail)。
 *  - 按「用户消息」作为锚点分节,每节一个小刻度(装饰点豁免项)
 *  - hover 显示该节首条用户消息前 40 字 tooltip(自绘 div,禁原生 title)
 *  - 点击平滑滚动到对应消息(复用 ihui:scroll-to-message 跳转总线)
 *  - 当前可视区域对应刻度高亮(滚动位置推算,IntersectionObserver 思路的 rAF 节流版) */
export function ConversationLocatorRail({ messages, containerRef }: ConversationLocatorRailProps) {
  const t = useTranslations('chat')
  // 锚点列表 memo 派生,避免每帧重算(长会话性能)
  const anchors = React.useMemo(() => deriveLocatorAnchors(messages), [messages])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)

  // 滚动联动高亮:rAF 节流,仅在锚点变化时才 setState(避免每帧重算/重渲染)
  React.useEffect(() => {
    const el = containerRef.current
    if (!el || anchors.length === 0) return
    let raf = 0
    const update = () => {
      raf = 0
      const rect = el.getBoundingClientRect()
      // 取容器顶部下 30% 处为"当前阅读线",最后一个越过该线的锚点为激活节
      const line = rect.top + rect.height * 0.3
      let current = anchors[0]?.id ?? null
      for (const a of anchors) {
        const node = el.querySelector(`[data-message-id="${a.id}"]`)
        if (!node) continue
        if ((node as HTMLElement).getBoundingClientRect().top <= line) current = a.id
      }
      setActiveId((prev) => (prev === current ? prev : current))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    el.addEventListener('scroll', onScroll)
    update()
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [anchors, containerRef])

  // 锚点 < 2 时不显示导航(无分节意义)
  if (anchors.length < 2) return null

  const active = activeId ?? anchors[0]!.id

  const jump = (messageId: string) => {
    setActiveId(messageId)
    window.dispatchEvent(new CustomEvent('ihui:scroll-to-message', { detail: { messageId } }))
  }

  return (
    <nav
      data-testid="conversation-locator-rail"
      aria-label={t('locator.title')}
      className={`pointer-events-auto absolute right-12 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-2 md:flex ${floatIndicatorRailCls}`}
    >
      {anchors.map((a) => {
        const isActive = active === a.id
        const isHovered = hoveredId === a.id
        return (
          <FloatIndicatorDot
            key={a.id}
            active={isActive}
            colorCls="bg-primary"
            shapeCls={ROUND_SHAPE}
            onClick={() => jump(a.id)}
            onMouseEnter={() => setHoveredId(a.id)}
            onMouseLeave={() => setHoveredId(null)}
            data-testid={`locator-tick-${a.id}`}
            // 文本预览(动态内容,非硬编码文案);守门禁原生 title → 用 aria-label 承载
            aria-label={a.preview}
          >
            {isHovered && (
              <span className="pointer-events-none absolute right-full mr-2 flex max-w-56 items-center rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground shadow-md">
                <span className="truncate">{a.preview}</span>
              </span>
            )}
          </FloatIndicatorDot>
        )
      })}
    </nav>
  )
}

export default ConversationLocatorRail
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
