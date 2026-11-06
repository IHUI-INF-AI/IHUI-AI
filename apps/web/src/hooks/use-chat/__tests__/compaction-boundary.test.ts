// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  BOUNDARY_ANCHOR_LABELS,
  getLiveCompactionBoundary,
  noteCompactionBoundary,
  summarizeCompactBoundary,
  type BoundaryShape,
} from '../compaction-boundary'

const boundary: BoundaryShape = {
  trigger: 'llm',
  tokensBefore: 120000,
  tokensAfter: 42000,
  messagesSummarized: 7,
  durationMs: 830,
  preservedSegment: {
    head: { index: 2, role: 'assistant', excerpt: '摘要之后被保留的第一条' },
    anchor: { index: 4, role: 'system', excerpt: '压缩摘要落在这里' },
    tail: { index: 5, role: 'user', excerpt: '被折叠区间的最后一条' },
  },
  removedRange: { startIndex: 2, endIndex: 5 },
}

describe('压缩边界摘要格式化（批次 3）', () => {
  it('head → anchor → tail 三条固定顺序，role/摘录/下标逐字段取出', () => {
    const summary = summarizeCompactBoundary(boundary)
    expect(summary.rows.map((row) => row.key)).toEqual(['head', 'anchor', 'tail'])
    expect(summary.rows.map((row) => row.label)).toEqual([
      BOUNDARY_ANCHOR_LABELS.head,
      BOUNDARY_ANCHOR_LABELS.anchor,
      BOUNDARY_ANCHOR_LABELS.tail,
    ])
    expect(summary.rows[0]).toMatchObject({
      role: 'assistant',
      excerpt: '摘要之后被保留的第一条',
      index: 2,
    })
    expect(summary.rows[1]).toMatchObject({ role: 'system', index: 4 })
    expect(summary.rows[2]).toMatchObject({ role: 'user', index: 5 })
  })

  it('removedRange 按人读的"第 X–Y 条"呈现（契约下标 0 起，闭区间）', () => {
    expect(summarizeCompactBoundary(boundary).removedRangeText).toBe('第 3–6 条被折叠')
  })

  it('无 removedRange 就不编造段号；缺失锚点不输出空行', () => {
    const partial: BoundaryShape = {
      ...boundary,
      preservedSegment: { head: null, anchor: boundary.preservedSegment.anchor, tail: null },
      removedRange: null,
    }
    const summary = summarizeCompactBoundary(partial)
    expect(summary.rows.map((row) => row.key)).toEqual(['anchor'])
    expect(summary.removedRangeText).toBeNull()
  })

  it('compaction 帧不带 boundary 时保持现状（不覆盖上一枚可回看边界）', () => {
    noteCompactionBoundary('conv-a', boundary)
    noteCompactionBoundary('conv-a', undefined)
    noteCompactionBoundary('conv-a', null)
    expect(getLiveCompactionBoundary('conv-a')).toEqual(boundary)
    expect(getLiveCompactionBoundary('conv-b')).toBeNull()
    expect(getLiveCompactionBoundary(null)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
