// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌‌​‌‍‍‌​​‌​​‌‍‍‌‌​‌‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​​‌​​‌‌‌‌‍‍​‌​​‌​​​‍‍‌‌‌‌‌‌​‍‍‌​‌​​​‌‍‍‌​‌‌‌‌‌‌‌​‌‌‌‍‍​‌‌‌‌‌‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌‌‌‌​‌‌‍‌‍‌​‍‍​‌​​​​‌‍‍​‌‌‌‌‌‌​‌​‌‍‍‌​​‌‌​‌‍⁠

/**
 * 压缩边界回看（批次 3，2026-11-06 立）。
 *
 * 两个数据源合流：
 *  ① compaction 帧的可选 `boundary`（流内事实，立即可看）；
 *  ② `GET /ai/chat/conversations/:id/compaction-boundaries`（落库回放，刷新后仍可看）。
 * 回放只读、失败静默 —— 回看是旁路能力，不得打断聊天主链路；也不改动压缩算法。
 */

import * as React from 'react'

import { fetchApi } from '@/lib/api'

/** 保留段锚点（与 shared `PreservedSegmentAnchor` 同形）。 */
export interface BoundaryAnchor {
  index: number
  role: string
  messageId?: string | null
  excerpt: string
  digest?: string
}

/** 压缩边界（与 shared `CompactBoundary` / api-client 快照同形，此处结构化兼容两地）。 */
export interface BoundaryShape {
  trigger: string
  tokensBefore: number
  tokensAfter: number
  messagesSummarized: number
  durationMs: number | null
  preservedSegment: {
    head: BoundaryAnchor | null
    anchor: BoundaryAnchor | null
    tail: BoundaryAnchor | null
  }
  removedRange: { startIndex: number; endIndex: number } | null
}

/** 查询回放的单条记录（id/createdAt 由网关补足）。 */
export interface CompactionBoundaryRecord extends BoundaryShape {
  id: string
  conversationId: string
  messageId?: string | null
  createdAt: string
}

interface CompactionBoundaryApiResponse {
  items: CompactionBoundaryRecord[]
}

/** 回看弹层的一行：三条锚点的固定顺序 head → anchor → tail。 */
export interface BoundarySummaryRow {
  key: 'head' | 'anchor' | 'tail'
  label: string
  role: string
  excerpt: string
  index: number
}

export interface BoundarySummary {
  rows: BoundarySummaryRow[]
  /** 「第 X–Y 条被折叠」；无范围时为 null（不编造段号）。 */
  removedRangeText: string | null
}

export const BOUNDARY_ANCHOR_LABELS: Record<BoundarySummaryRow['key'], string> = {
  head: '摘要后首条保留',
  anchor: '摘要落点',
  tail: '摘要前末条被折叠',
}

/**
 * 边界 → 展示摘要（纯函数，供组件与单测共用）。
 * `removedRange` 契约下标 0 起，这里按人读的「第 X–Y 条」转成 1 起，并注明区间是闭区间。
 */
export function summarizeCompactBoundary(boundary: BoundaryShape): BoundarySummary {
  const rows: BoundarySummaryRow[] = []
  for (const key of ['head', 'anchor', 'tail'] as const) {
    const anchor = boundary.preservedSegment[key]
    if (!anchor) continue
    rows.push({
      key,
      label: BOUNDARY_ANCHOR_LABELS[key],
      role: anchor.role,
      excerpt: anchor.excerpt,
      index: anchor.index,
    })
  }
  const range = boundary.removedRange
  return {
    rows,
    removedRangeText: range ? `第 ${range.startIndex + 1}–${range.endIndex + 1} 条被折叠` : null,
  }
}

// ── 模块级 live 边界（当前会话最近一次压缩帧） ───────────────────────────────
let liveBoundary: { conversationId: string; boundary: BoundaryShape } | null = null
const boundaryListeners = new Set<() => void>()

function notifyBoundaryListeners(): void {
  for (const listener of boundaryListeners) listener()
}

/**
 * compaction 帧写点：只有真正带 boundary 的帧才覆盖（旧帧缺席 ⇒ 保持现状，
 * 不能把"没被告知"改写成"没有压缩"，也不能清掉上一枚可回看边界）。
 */
export function noteCompactionBoundary(
  conversationId: string,
  boundary: BoundaryShape | null | undefined,
): void {
  if (!boundary) return
  liveBoundary = { conversationId, boundary }
  notifyBoundaryListeners()
}

export function getLiveCompactionBoundary(conversationId: string | null): BoundaryShape | null {
  if (!conversationId || !liveBoundary) return null
  return liveBoundary.conversationId === conversationId ? liveBoundary.boundary : null
}

export function getCompactionBoundaryServerSnapshot(): null {
  return null
}

export function subscribeCompactionBoundary(listener: () => void): () => void {
  boundaryListeners.add(listener)
  return () => {
    boundaryListeners.delete(listener)
  }
}

/** 回放里挑最新一条（接口未承诺排序，按 createdAt 取最大）。 */
function latestBoundary(items: CompactionBoundaryRecord[]): CompactionBoundaryRecord | null {
  let latest: CompactionBoundaryRecord | null = null
  let latestAt = Number.NEGATIVE_INFINITY
  for (const item of items) {
    const at = Date.parse(item.createdAt)
    const stamp = Number.isFinite(at) ? at : Number.NEGATIVE_INFINITY
    if (latest === null || stamp > latestAt) {
      latest = item
      latestAt = stamp
    }
  }
  return latest
}

/**
 * 进入会话时拉取最近一条边界；live 帧优先。查询失败静默（返回 null，不抛）。
 */
export function useLatestCompactionBoundary(conversationId: string | null): {
  boundary: BoundaryShape | null
  loading: boolean
} {
  const live = React.useSyncExternalStore(
    subscribeCompactionBoundary,
    () => getLiveCompactionBoundary(conversationId),
    getCompactionBoundaryServerSnapshot,
  )
  const [replayed, setReplayed] = React.useState<{
    conversationId: string
    boundary: CompactionBoundaryRecord
  } | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!conversationId) {
      setReplayed(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    let disposed = false
    setLoading(true)
    void (async () => {
      try {
        const result = await fetchApi<CompactionBoundaryApiResponse>(
          `/ai/chat/conversations/${encodeURIComponent(conversationId)}/compaction-boundaries?limit=20`,
          { signal: controller.signal },
        )
        if (disposed || controller.signal.aborted) return
        if (!result.success || !result.data?.items) {
          setReplayed(null)
          return
        }
        const item = latestBoundary(result.data.items)
        setReplayed(item ? { conversationId, boundary: item } : null)
      } catch {
        if (!disposed && !controller.signal.aborted) setReplayed(null)
      } finally {
        if (!disposed && !controller.signal.aborted) setLoading(false)
      }
    })()
    return () => {
      disposed = true
      controller.abort()
    }
  }, [conversationId])

  if (live) return { boundary: live, loading: false }
  if (replayed && replayed.conversationId === conversationId) {
    return { boundary: replayed.boundary, loading }
  }
  return { boundary: null, loading }
}
