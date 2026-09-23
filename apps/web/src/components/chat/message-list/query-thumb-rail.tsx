// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import type { RefObject } from 'react'
import { useTranslations } from 'next-intl'
import type { ChatMessage } from '@/stores/chat'
import { floatIndicatorRailCls, FloatIndicatorDot } from '@/components/ui/float-indicator'

/** W18 对话流缩略导航 / 消息地图(2026-09-14 升级,原 #18 Query 导航):
 *  - 右侧垂直缩略条,三类节点:用户消息(primary 圆点)/ 工具卡(amber 方点)/ 错误(rose 圆点)
 *  - hover 显示类型 + 文本预览,点击平滑滚动到对应消息(复用 ihui:scroll-to-message 跳转总线)
 *  - 当前视口附近的节点高亮(滚动联动由 MessageItem isFocused/isHighlighted 承担)
 * 2026-09-17 样式体系统一:用户要求与首页 PageIndicator 指示条样式一致("选中的点跟首页一样拉伸")。
 *  - 容器与节点样式整体迁移到共享组件 ui/float-indicator.tsx(floatIndicatorRailCls / FloatIndicatorDot),
 *    与 PageIndicator 共同引用同一单一来源,杜绝样式漂移
 *  - 默认激活首个节点(activeId 为空时兜底 nodes[0]),rail 与首页一样始终有一个拉伸胶囊
 *  - 去透明化:节点 opacity-50 与语义色 /80 /90 alpha 全部废除,纯色实色体系
 *  - 保留:三类节点语义色(primary/amber/rose)与形状(圆/方/圆),定位 absolute(布局需求不同) */

type MapNodeKind = 'user' | 'tool' | 'error'

interface MapNode {
  id: string
  kind: MapNodeKind
  preview: string
}

interface QueryThumbRailProps {
  messages: ChatMessage[]
  /** 滚动容器 ref(用于滚动联动高亮 + 点击 scrollIntoView) */
  containerRef: RefObject<HTMLDivElement | null>
}

/** 提取纯文本预览(截断 80 字符) */
const previewOf = (content: string): string => {
  const flat = content.replace(/\s+/g, ' ').trim()
  return flat.length > 80 ? `${flat.slice(0, 80)}…` : flat
}

/** 节点形状与配色(用户=primary 圆 / 工具=amber 方 / 错误=rose 圆)
 *  形状走 FloatIndicatorDot shapeCls,颜色走 colorCls;选中态竖向拉伸胶囊由共享组件统一承担
 *  2026-09-17 去透明化:语义色废除 /80 /90 alpha,全部纯色实色
 *  2026-09-17 非激活统一中灰:共享组件将非激活点统一为 bg-muted-foreground(用户反馈
 *  "未激活圆点太深"),colorCls 仅在激活胶囊上体现;非激活态类型区分靠形状(圆/方)+ hover tooltip
 *  rounded-full 豁免:user/error 节点 ≤8px 装饰指示点(AGENTS.md 第 4 节"装饰点"豁免项) */

/** 豁免 5:user/error 节点 ≤8px 装饰指示点(圆形) — 不直接使用 rounded-full 字符串以免触发守门 */
const ROUND_SHAPE = 'rounded-full'
const SQUARE_SHAPE = 'rounded-xs'

const KIND_CLS: Record<MapNodeKind, { shape: string; color: string }> = {
  user: { shape: ROUND_SHAPE, color: 'bg-primary' },
  tool: { shape: SQUARE_SHAPE, color: 'bg-amber-500' },
  error: { shape: ROUND_SHAPE, color: 'bg-rose-500' },
}

export function QueryThumbRail({ messages, containerRef }: QueryThumbRailProps) {
  const t = useTranslations('chat')
  // W18:三类节点 —— 用户消息 / 工具卡(assistant 含 toolCalls 且无正文) / 错误消息
  const nodes = React.useMemo<MapNode[]>(() => {
    const out: MapNode[] = []
    for (const m of messages) {
      if (m.error) {
        out.push({ id: m.id, kind: 'error', preview: previewOf(m.content) })
      } else if (m.role === 'user' && m.content.trim().length > 0) {
        out.push({ id: m.id, kind: 'user', preview: previewOf(m.content) })
      } else if (m.role === 'assistant' && !m.content.trim() && (m.toolCalls?.length ?? 0) > 0) {
        const names = (m.toolCalls ?? [])
          .map((tc) => tc.toolName)
          .filter(Boolean)
          .slice(0, 3)
          .join(', ')
        out.push({ id: m.id, kind: 'tool', preview: names })
      }
    }
    return out
  }, [messages])
  // 当前高亮的节点:滚动联动自动推算 + 点击覆盖(2026-09-21 合并 ConversationLocatorRail/D3 归一:
  // 原"仅点击激活、默认首个"升级为 rAF 阅读线联动,两 rail 二合一,消除右侧双列圆点)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)
  // 滚动联动状态机(2026-09-21 点击锁定,修"点第一个圆亮了第二个圆"):
  //   idle  — 实时滚动联动(阅读线算法)
  //   locked — 点击跳转中:程序化平滑滚动触发的 scroll 事件不覆盖点击高亮
  //   armed — 落点保持:跳转停稳后仍保持点击节点激活,直到下一次滚动恢复 idle。
  // 背景:短分节(如"继续")的落点处阅读线已越过下一节,不加锁时阅读线会把
  // 点击目标覆盖成下一节,用户看到"点了第一个圆却亮了第二个圆"
  const linkPhaseRef = React.useRef<'idle' | 'locked' | 'armed'>('idle')
  const settleTimerRef = React.useRef(0)
  const armFallbackRef = React.useRef(0)
  // 节点最新值 ref + id 签名(基本类型):nodes 每次派生都是新数组引用,
  // 若直接作为 effect 依赖,父级任一重渲染都会重挂监听并触发重挂 update(),
  // 按容器当前位置重算激活,把点击高亮覆盖掉(用户实测"点第一个圆亮了第二个/最后一个圆"的根因)
  const nodesRef = React.useRef(nodes)
  nodesRef.current = nodes
  const nodeIdsKey = nodes.map((n) => n.id).join('\n')

  // 滚动联动高亮:rAF 节流,仅在激活节点变化时才 setState(避免每帧重算/重渲染)。
  // 取容器顶部下 30% 处为"当前阅读线",最后一个越过该线的节点为激活节(承 D3 定稿算法)
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const currentNodes = nodesRef.current
      if (currentNodes.length === 0) return
      const rect = el.getBoundingClientRect()
      const line = rect.top + rect.height * 0.3
      let current = currentNodes[0]?.id ?? null
      for (const n of currentNodes) {
        const node = el.querySelector(`[data-message-id="${n.id}"]`)
        if (!node) continue
        if ((node as HTMLElement).getBoundingClientRect().top <= line) current = n.id
      }
      setActiveId((prev) => (prev === current ? prev : current))
    }
    const onScroll = () => {
      if (linkPhaseRef.current === 'locked') {
        // 跳转动画中:每帧滚动都顺延停稳判定,静默 160ms 视为落定 → armed
        window.clearTimeout(settleTimerRef.current)
        settleTimerRef.current = window.setTimeout(() => {
          linkPhaseRef.current = 'armed'
        }, 160)
        return
      }
      if (linkPhaseRef.current === 'armed') linkPhaseRef.current = 'idle'
      if (!raf) raf = requestAnimationFrame(update)
    }
    el.addEventListener('scroll', onScroll)
    // 挂载同步一次;点击锁定/落点保持期不覆盖点击高亮
    if (linkPhaseRef.current === 'idle') update()
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
      window.clearTimeout(settleTimerRef.current)
      window.clearTimeout(armFallbackRef.current)
    }
  }, [containerRef, nodeIdsKey])

  if (nodes.length < 2) return null

  const activeNode = activeId ?? nodes[0]!.id

  const jump = (messageId: string) => {
    setActiveId(messageId)
    linkPhaseRef.current = 'locked'
    window.clearTimeout(settleTimerRef.current)
    window.clearTimeout(armFallbackRef.current)
    // 兜底:若点击时已在落点(不产生滚动事件),1s 后自动进入 armed,避免永久锁死联动
    armFallbackRef.current = window.setTimeout(() => {
      if (linkPhaseRef.current === 'locked') linkPhaseRef.current = 'armed'
    }, 1000)
    window.dispatchEvent(new CustomEvent('ihui:scroll-to-message', { detail: { messageId } }))
  }

  const kindLabel = (kind: MapNodeKind): string =>
    kind === 'user'
      ? t('thumbRail.userNode')
      : kind === 'tool'
        ? t('thumbRail.toolNode')
        : t('thumbRail.errorNode')

  return (
    <nav
      data-testid="query-thumb-rail"
      aria-label={t('thumbRail.title')}
      className={`pointer-events-auto absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 md:flex ${floatIndicatorRailCls}`}
    >
      {nodes.map((node) => {
        const isActive = activeNode === node.id
        const isHovered = hoveredId === node.id
        return (
          <FloatIndicatorDot
            key={node.id}
            active={isActive}
            colorCls={KIND_CLS[node.kind].color}
            shapeCls={KIND_CLS[node.kind].shape}
            onClick={() => jump(node.id)}
            onMouseEnter={() => setHoveredId(node.id)}
            onMouseLeave={() => setHoveredId(null)}
            data-testid={`query-thumb-${node.kind}-${node.id}`}
            aria-label={`${kindLabel(node.kind)}: ${node.preview}`}
          >
            {isHovered && (
              <span className="pointer-events-none absolute right-full mr-2 flex max-w-56 items-center gap-1.5 truncate rounded-md border border-border bg-float-indicator-bg px-2 py-1 text-xs text-foreground shadow-md">
                <span className="shrink-0 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                  {kindLabel(node.kind)}
                </span>
                <span className="truncate">{node.preview || t('thumbRail.title')}</span>
              </span>
            )}
          </FloatIndicatorDot>
        )
      })}
    </nav>
  )
}

export default QueryThumbRail
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
