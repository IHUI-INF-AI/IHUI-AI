// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useTt } from '@/i18n'
import type { CompactBoundary } from '@ihui/shared'
import { boundarySegmentViews, formatBoundaryRange, type BoundarySlot } from './chat-cap-text'

/** 保留段槽位的端内兜底词(缺失词表键时使用,避免出现原始英文 key)。 */
const SLOT_LABEL: Record<BoundarySlot, { key: string; fallback: string }> = {
  head: { key: 'ai.compactionBoundary.head', fallback: '保留段·首条' },
  anchor: { key: 'ai.compactionBoundary.anchor', fallback: '摘要锚点' },
  tail: { key: 'ai.compactionBoundary.tail', fallback: '折叠前末条' },
}

interface CompactionBoundaryStripProps {
  /** 批次 3:最近一次压缩边界;null/缺省 = 不渲染(旧会话/旧后端无此能力)。 */
  boundary: CompactBoundary | null
}

/**
 * 压缩边界回看条(小程序消费端)。
 *
 * 语义与批次 3 契约一致:
 *  · 折叠态只报"已压缩 + 折叠条数 + token 前后",不改变聊天流布局;
 *  · 展开后按 head → anchor → tail 展示压缩前关键片段,并给出 removedRange;
 *  · 空锚点不占行、无区间不造 `#0 – #0`;整块没有可回看内容时不给展开入口。
 */
export default function CompactionBoundaryStrip({ boundary }: CompactionBoundaryStripProps) {
  const tt = useTt()
  const [expanded, setExpanded] = useState(false)
  if (!boundary) return null

  const segments = boundarySegmentViews(boundary)
  const range = formatBoundaryRange(boundary)
  const canExpand = segments.length > 0 || range !== null

  return (
    <View className="compact-boundary">
      <View
        className="compact-boundary-head"
        hoverClass={canExpand ? 'opacity-60' : 'none'}
        onClick={() => {
          if (canExpand) setExpanded((v) => !v)
        }}
      >
        <Text className="compact-boundary-title">
          {tt('ai.compactionBoundary.title', '上下文已压缩')} ·{' '}
          {tt('ai.compactionBoundary.summary', '折叠 {n} 条 · {before} → {after} token', {
            n: String(boundary.messagesSummarized),
            before: boundary.tokensBefore.toLocaleString(),
            after: boundary.tokensAfter.toLocaleString(),
          })}
        </Text>
        {canExpand ? (
          <Text className="compact-boundary-toggle">
            {expanded
              ? tt('ai.compactionBoundary.collapse', '收起')
              : tt('ai.compactionBoundary.expand', '查看压缩前关键片段')}
          </Text>
        ) : null}
      </View>
      {expanded && canExpand ? (
        <View className="compact-boundary-panel">
          {segments.map(({ slot, anchor }) => (
            <View key={slot} className="compact-boundary-row">
              <Text className="compact-boundary-label">
                {tt(SLOT_LABEL[slot].key, SLOT_LABEL[slot].fallback)}
              </Text>
              <Text className="compact-boundary-meta">
                #{anchor.index} · {anchor.role}
              </Text>
              <Text className="compact-boundary-excerpt">{anchor.excerpt}</Text>
            </View>
          ))}
          {range ? (
            <View className="compact-boundary-row">
              <Text className="compact-boundary-label">
                {tt('ai.compactionBoundary.removedRange', '折叠范围')}
              </Text>
              <Text className="compact-boundary-meta">{range}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
