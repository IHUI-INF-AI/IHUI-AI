// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import type { ChatMessage } from '@/stores/chat'

/** W18 对话流缩略导航 / 消息地图(2026-09-14 升级,原 #18 Query 导航):
 *  - 右侧垂直缩略条,三类节点:用户消息(primary 圆点)/ 工具卡(amber 方点)/ 错误(rose 圆点)
 *  - hover 显示类型 + 文本预览,点击平滑滚动到对应消息(复用 ihui:scroll-to-message 跳转总线)
 *  - 当前视口附近的节点高亮(滚动联动由 MessageItem isFocused/isHighlighted 承担) */

type MapNodeKind = 'user' | 'tool' | 'error'

interface MapNode {
  id: string
  kind: MapNodeKind
  preview: string
}

interface QueryThumbRailProps {
  messages: ChatMessage[]
}

/** 提取纯文本预览(截断 80 字符) */
const previewOf = (content: string): string => {
  const flat = content.replace(/\s+/g, ' ').trim()
  return flat.length > 80 ? `${flat.slice(0, 80)}…` : flat
}

/** 节点形态与配色(用户=primary 圆 / 工具=amber 方 / 错误=rose 圆)
 *  @allow-rounded-full 节点为 6-8px 纯装饰圆点(尺寸 h-1.5/h-2 在 size 变量拼接),豁免 5 */
const KIND_CLS: Record<MapNodeKind, string> = {
  user: 'rounded-full bg-primary',
  tool: 'rounded-[2px] bg-amber-500/80',
  error: 'rounded-full bg-rose-500/90',
}

export function QueryThumbRail({ messages }: QueryThumbRailProps) {
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
  // 当前高亮的节点(最近一次点击),滚动联动由 MessageItem isFocused/isHighlighted 承担
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)

  if (nodes.length < 2) return null

  const jump = (messageId: string) => {
    setActiveId(messageId)
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
      className="pointer-events-auto absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-1.5 rounded-xl border border-border bg-background/80 px-1.5 py-2 shadow-sm backdrop-blur md:flex"
    >
      {nodes.map((node) => {
        const isActive = activeId === node.id
        const isHovered = hoveredId === node.id
        const size =
          node.kind === 'user' ? 'h-1.5 w-1.5' : node.kind === 'tool' ? 'h-2 w-2' : 'h-2 w-2'
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => jump(node.id)}
            onMouseEnter={() => setHoveredId(node.id)}
            onMouseLeave={() => setHoveredId(null)}
            data-testid={`query-thumb-${node.kind}-${node.id}`}
            aria-label={`${kindLabel(node.kind)}: ${node.preview}`}
            className={`group relative flex items-center justify-center transition-all ${
              isActive
                ? 'scale-125 ring-2 ring-primary/40 ' + size
                : isHovered
                  ? 'scale-110 opacity-80 ' + size
                  : 'opacity-50 hover:opacity-80 ' + size
            } ${KIND_CLS[node.kind]}`}
          >
            {isHovered && (
              <span className="pointer-events-none absolute right-full mr-2 flex max-w-56 items-center gap-1.5 truncate rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
                <span className="shrink-0 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                  {kindLabel(node.kind)}
                </span>
                <span className="truncate">{node.preview || t('thumbRail.title')}</span>
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

export default QueryThumbRail
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
