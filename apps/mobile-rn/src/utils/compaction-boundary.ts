// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 压缩边界摘要的纯格式化出口(批次 3,2026-11-06)。
 *
 * 形状取自 `CompactBoundary`:preservedSegment 三个锚点 head/anchor/tail +
 * removedRange 闭区间。UI 只消费这里的派生结果,不在渲染位里各写一套下标/文案拼接。
 */
import type { CompactBoundary, PreservedSegmentAnchor } from '@ihui/shared'

export type CompactBoundarySlot = 'head' | 'anchor' | 'tail'

export interface CompactBoundaryAnchorLine {
  slot: CompactBoundarySlot
  /** 槽位中文名(渲染标题用) */
  label: string
  /** 压缩前消息下标(0 起) */
  index: number
  role: string
  excerpt: string
}

const SLOT_ORDER: readonly CompactBoundarySlot[] = ['head', 'anchor', 'tail']

const SLOT_LABELS: Record<CompactBoundarySlot, string> = {
  head: '保留段起点 head',
  anchor: '摘要落点 anchor',
  tail: '被压缩末条 tail',
}

function readAnchor(
  slot: CompactBoundarySlot,
  anchor: PreservedSegmentAnchor | null | undefined,
): CompactBoundaryAnchorLine | null {
  if (!anchor) return null
  const excerpt = anchor.excerpt.trim()
  if (excerpt === '') return null
  return {
    slot,
    label: SLOT_LABELS[slot],
    index: anchor.index,
    role: anchor.role,
    excerpt,
  }
}

/** head/anchor/tail 按固定槽位顺序展开;缺席或空摘录的槽位不产出行(不拿占位符假装已回看)。 */
export function boundaryAnchorLines(boundary: CompactBoundary): CompactBoundaryAnchorLine[] {
  const lines: CompactBoundaryAnchorLine[] = []
  for (const slot of SLOT_ORDER) {
    const line = readAnchor(slot, boundary.preservedSegment[slot])
    if (line) lines.push(line)
  }
  return lines
}

/** removedRange → 一句中文;区间非法(结束 < 开始)或缺失时返回 null。 */
export function formatRemovedRange(range: CompactBoundary['removedRange']): string | null {
  if (!range) return null
  const count = range.endIndex - range.startIndex + 1
  if (count <= 0) return null
  return `压缩前消息下标 ${range.startIndex}–${range.endIndex}（共 ${count} 条）`
}
