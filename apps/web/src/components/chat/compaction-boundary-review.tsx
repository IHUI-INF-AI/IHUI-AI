// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import {
  BOUNDARY_ANCHOR_LABELS,
  summarizeCompactBoundary,
  useLatestCompactionBoundary,
  type BoundarySummaryRow,
} from '@/hooks/use-chat/compaction-boundary'

const ANCHOR_ORDER: Array<BoundarySummaryRow['key']> = ['head', 'anchor', 'tail']

/**
 * 压缩边界回看（批次 3）。挂载在消息流尾部，与既有 CompactionStatusBar 并存：
 *  - 有 boundary ⇒ 一行入口「查看压缩前关键片段」；
 *  - 无 boundary（旧帧/未压缩）⇒ 整段不渲染，既有文案原样不变。
 */
export function CompactionBoundaryReview({ conversationId }: { conversationId: string | null }) {
  const { boundary } = useLatestCompactionBoundary(conversationId)
  const [open, setOpen] = React.useState(false)

  if (!boundary) return null

  const summary = summarizeCompactBoundary(boundary)
  const rowByKey = new Map(summary.rows.map((row) => [row.key, row]))

  return (
    <div
      className="mx-2 my-1.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-[12px]"
      data-testid="compaction-boundary-review"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left font-medium text-foreground transition-colors hover:bg-accent"
        data-testid="compaction-boundary-toggle"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span>查看压缩前关键片段</span>
        <span className="ml-auto shrink-0 text-[11px] font-normal text-muted-foreground">
          {boundary.tokensBefore} → {boundary.tokensAfter} tokens
        </span>
      </button>

      {open && (
        <div className="mt-1.5 flex flex-col gap-1" data-testid="compaction-boundary-panel">
          {ANCHOR_ORDER.map((key) => {
            const row = rowByKey.get(key)
            return (
              <div
                key={key}
                className="rounded-sm bg-background/60 px-2 py-1 text-[11px]"
                data-testid={`compaction-boundary-anchor-${key}`}
              >
                <div className="flex items-baseline gap-1.5 text-muted-foreground">
                  <span className="shrink-0">{BOUNDARY_ANCHOR_LABELS[key]}</span>
                  {row ? (
                    <>
                      <span className="shrink-0 rounded-sm bg-muted px-1">{row.role}</span>
                      <span className="shrink-0 tabular-nums">#{row.index}</span>
                    </>
                  ) : (
                    <span className="shrink-0">未提供</span>
                  )}
                </div>
                {row ? (
                  <p className="mt-0.5 break-words text-foreground/90">{row.excerpt}</p>
                ) : null}
              </div>
            )
          })}
          {summary.removedRangeText ? (
            <p
              className="text-[11px] text-muted-foreground"
              data-testid="compaction-boundary-removed-range"
            >
              {summary.removedRangeText}
            </p>
          ) : null}
          {typeof boundary.durationMs === 'number' ? (
            <p className="text-[11px] text-muted-foreground">{boundary.durationMs} ms</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
