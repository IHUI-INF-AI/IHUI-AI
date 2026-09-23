// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { PlanVersionSnapshot } from '@/lib/plan-version-history'
import { diffPlanVersions } from '@/lib/plan-version-history'
import type { PlanStepChangeKind } from '@/lib/plan-version-history'

interface PlanVersionDiffProps {
  versions: PlanVersionSnapshot[]
  /** 实时 plan 的即时快照(对比目标"最新"用,不落盘) */
  liveSnapshot: PlanVersionSnapshot | null
  initialFrom: number | null
  initialTo: number | null
  onClose: () => void
}

const KIND_META: Record<PlanStepChangeKind, { label: string; cls: string }> = {
  added: { label: 'Added', cls: 'bg-emerald-50 text-emerald-700 border-emerald-500' },
  removed: { label: 'Removed', cls: 'bg-rose-50 text-rose-700 border-rose-500' },
  modified: { label: 'Modified', cls: 'bg-amber-50 text-amber-700 border-amber-500' },
  unchanged: { label: 'Unchanged', cls: 'bg-slate-50 text-slate-500 border-slate-300' },
}

function labelOf(
  versions: PlanVersionSnapshot[],
  liveSnapshot: PlanVersionSnapshot | null,
  version: number | null,
): string {
  if (version === null) return liveSnapshot?.label ?? 'Latest'
  const found = versions.find((v) => v.version === version)
  return found?.label ?? `Round ${version}`
}

/**
 * Plan 跨版本 diff 面板(D93):from/to 双选 + 差异明细。
 * D93 英文过渡(词表释放后换中文键 planVersion*):packages/i18n 词表被并行会话占用,
 * 先用英文过渡,词表可用后换回中文键(见 D93 键清单英文列)。
 */
export function PlanVersionDiff({
  versions,
  liveSnapshot,
  initialFrom,
  initialTo,
  onClose,
}: PlanVersionDiffProps) {
  const [fromVersion, setFromVersion] = React.useState<number | null>(initialFrom)
  const [toVersion, setToVersion] = React.useState<number | null>(initialTo)

  const fromSnap =
    fromVersion === null ? liveSnapshot : (versions.find((v) => v.version === fromVersion) ?? null)
  const toSnap =
    toVersion === null ? liveSnapshot : (versions.find((v) => v.version === toVersion) ?? null)

  const diff = fromSnap !== null && toSnap !== null ? diffPlanVersions(fromSnap, toSnap) : null
  const sameVersion = fromVersion === toVersion && fromSnap !== null

  const renderOption = (value: number | null, label: string): React.ReactNode => (
    <option
      key={value === null ? 'live' : `v${value}`}
      value={value === null ? 'live' : String(value)}
    >
      {label}
    </option>
  )

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Compare versions</span>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close version diff">
          <X className="h-3.5 w-3.5" />
          <span>Close</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={fromVersion === null ? 'live' : String(fromVersion)}
          onChange={(e) => {
            const v = e.target.value
            setFromVersion(v === 'live' ? null : Number(v))
          }}
          className="h-7 cursor-pointer rounded-md border border-input bg-background px-2.5 text-xs font-medium outline-none"
          aria-label="Diff source version"
        >
          {versions.map((v) => renderOption(v.version, v.label))}
          {renderOption(null, liveSnapshot?.label ?? 'Latest')}
        </select>
        <span className="text-xs text-muted-foreground">vs</span>
        <select
          value={toVersion === null ? 'live' : String(toVersion)}
          onChange={(e) => {
            const v = e.target.value
            setToVersion(v === 'live' ? null : Number(v))
          }}
          className="h-7 cursor-pointer rounded-md border border-input bg-background px-2.5 text-xs font-medium outline-none"
          aria-label="Diff target version"
        >
          {versions.map((v) => renderOption(v.version, v.label))}
          {renderOption(null, liveSnapshot?.label ?? 'Latest')}
        </select>
      </div>

      {diff === null ? (
        <p className="text-sm text-muted-foreground">Select two versions to view the diff</p>
      ) : sameVersion ? (
        <p className="text-sm text-muted-foreground">
          {labelOf(versions, liveSnapshot, fromVersion)} is identical; select two different versions
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-700">
              Added {diff.summary.added}
            </span>
            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-rose-700">
              Removed {diff.summary.removed}
            </span>
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-700">
              Modified {diff.summary.modified}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-500">
              Unchanged {diff.summary.unchanged}
            </span>
          </div>
          {(diff.goalChanged || diff.scopeChanged) && (
            <p className="text-xs text-muted-foreground">
              {[
                diff.goalChanged ? 'Goal changed' : null,
                diff.scopeChanged ? 'Scope/constraints changed' : null,
              ]
                .filter((s): s is string => s !== null)
                .join(' · ')}
            </p>
          )}
          {diff.changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Steps are identical in both versions</p>
          ) : (
            diff.changes.map((change) => {
              const meta = KIND_META[change.kind]
              return (
                <div
                  key={`${change.kind}-${change.stepId}`}
                  className={cn('rounded-md border-l-2 p-2.5', meta.cls)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{change.title}</span>
                    <span className="shrink-0 text-xs opacity-80">{meta.label}</span>
                  </div>
                  <p className="mt-0.5 text-xs opacity-80">{change.detail}</p>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default PlanVersionDiff
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
