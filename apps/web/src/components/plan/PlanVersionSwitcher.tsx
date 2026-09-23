// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { ArrowLeftRight, History, RotateCcw } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import type { PlanVersionSnapshot } from '@/lib/plan-version-history'

interface PlanVersionSwitcherProps {
  versions: PlanVersionSnapshot[]
  /** null = 正在看最新(实时 plan),数字 = 正在看历史某轮(只读) */
  selectedVersion: number | null
  onSelect: (version: number | null) => void
  /** 跨版本 diff 入口 */
  onOpenDiff: () => void
}

/**
 * Plan 历史版本切换器(D93):按"轮"切换 + 跨版本 diff 入口 + 空态。
 * D93 英文过渡(词表释放后换中文键 planVersion*):packages/i18n 词表被并行会话占用,
 * 先用英文过渡,词表可用后换回中文键(见 D93 键清单英文列)。
 */
export function PlanVersionSwitcher({
  versions,
  selectedVersion,
  onSelect,
  onOpenDiff,
}: PlanVersionSwitcherProps) {
  const viewingHistory = selectedVersion !== null

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Versions</span>
          {versions.length > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-muted px-1 text-[10px] font-semibold leading-none tabular-nums text-muted-foreground">
              {versions.length}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenDiff}
          disabled={versions.length === 0}
          aria-label="Open version diff"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span>Compare</span>
        </Button>
      </div>

      {versions.length === 0 ? (
        <div className="rounded-md border border-dashed py-6 text-center">
          <p className="text-sm text-muted-foreground">No history yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Round versions appear here after structure changes
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedVersion === null ? 'latest' : String(selectedVersion)}
            onChange={(e) => {
              const v = e.target.value
              onSelect(v === 'latest' ? null : Number(v))
            }}
            className="h-7 cursor-pointer rounded-md border border-input bg-background px-2.5 text-xs font-medium outline-none"
            aria-label="Select version"
          >
            <option value="latest">Latest</option>
            {versions.map((v) => (
              <option key={v.version} value={String(v.version)}>
                {v.label}
              </option>
            ))}
          </select>
          {viewingHistory && (
            <>
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                Viewing round {selectedVersion} (read-only)
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSelect(null)}
                aria-label="Back to latest"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Back to latest</span>
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default PlanVersionSwitcher
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
