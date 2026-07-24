'use client'

import * as React from 'react'
import { Check, X, Loader2, AlertCircle, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { InlineDiffInfo } from './types'
import type { DiffApplyStatus } from '@/stores/chat'

/**
 * Inline Diff 卡片:edit_file/write_file 工具调用专用渲染。
 *
 * 2026-07-22 立 P3 深度层:聊天面板内直接查看代码 diff + Accept/Reject 应用改动。
 *
 * 注意:diff 算法与 `apps/web/src/components/ai/diff-preview.tsx` 的 `computeLcsDiff`
 * 完全一致(真正的 LCS 动态规划)。该函数未导出,且本组件受任务文件清单约束无法修改
 * diff-preview.tsx,故在此内联实现(算法本身是经典 LCS,无业务逻辑差异)。
 */

type DiffOp = 'equal' | 'insert' | 'delete'

interface DiffRow {
  op: DiffOp
  oldLine?: string
  newLine?: string
  oldNum?: number
  newNum?: number
}

function computeLcsDiff(oldLines: string[], newLines: string[]): DiffRow[] {
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))

  for (let i = m - 1; i >= 0; i--) {
    const row = dp[i]
    const nextRow = dp[i + 1]
    if (!row || !nextRow) continue
    for (let j = n - 1; j >= 0; j--) {
      if ((oldLines[i] ?? '') === (newLines[j] ?? '')) {
        row[j] = (nextRow[j + 1] ?? 0) + 1
      } else {
        row[j] = Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0)
      }
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  let oldNum = 0
  let newNum = 0

  while (i < m && j < n) {
    if ((oldLines[i] ?? '') === (newLines[j] ?? '')) {
      oldNum++
      newNum++
      rows.push({ op: 'equal', oldLine: oldLines[i], newLine: newLines[j], oldNum, newNum })
      i++
      j++
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      oldNum++
      rows.push({ op: 'delete', oldLine: oldLines[i], oldNum })
      i++
    } else {
      newNum++
      rows.push({ op: 'insert', newLine: newLines[j], newNum })
      j++
    }
  }

  while (i < m) {
    oldNum++
    rows.push({ op: 'delete', oldLine: oldLines[i], oldNum })
    i++
  }
  while (j < n) {
    newNum++
    rows.push({ op: 'insert', newLine: newLines[j], newNum })
    j++
  }

  return rows
}

interface InlineDiffCardProps {
  diffInfo: InlineDiffInfo
  applyStatus?: DiffApplyStatus
  applyError?: string
  /** 点击 Accept:由父组件触发 API 调用并更新 applyStatus */
  onApply?: () => void
  /** 点击 Reject:仅本地标记为 rejected,无 API 调用 */
  onReject?: () => void
}

/** 顶部状态徽章配置 */
const STATUS_BADGE: Record<
  DiffApplyStatus,
  { label: string; className: string; icon?: React.ComponentType<{ className?: string }> }
> = {
  pending: { label: '待确认', className: 'bg-muted text-muted-foreground' },
  applying: { label: '应用中', className: 'bg-muted text-muted-foreground', icon: Loader2 },
  applied: { label: '已应用', className: 'bg-green-500/15 text-green-600', icon: Check },
  rejected: { label: '已拒绝', className: 'bg-muted text-muted-foreground', icon: X },
  error: { label: '应用失败', className: 'bg-red-500/15 text-red-600', icon: AlertCircle },
}

export function InlineDiffCard({
  diffInfo,
  applyStatus = 'pending',
  applyError,
  onApply,
  onReject,
}: InlineDiffCardProps) {
  const rows = React.useMemo(
    () => computeLcsDiff(diffInfo.old_content.split('\n'), diffInfo.new_content.split('\n')),
    [diffInfo.old_content, diffInfo.new_content],
  )

  // 统计 add/remove 行数
  const stats = React.useMemo(() => {
    let added = 0
    let removed = 0
    for (const r of rows) {
      if (r.op === 'insert') added++
      else if (r.op === 'delete') removed++
    }
    return { added, removed }
  }, [rows])

  const badge = STATUS_BADGE[applyStatus] ?? STATUS_BADGE.pending
  const BadgeIcon = badge.icon
  const isTerminal = applyStatus === 'applied' || applyStatus === 'rejected'
  const isApplying = applyStatus === 'applying'

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-2 p-3">
        <div className="flex w-full items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <CardTitle
            className="flex-1 break-all text-xs font-medium"
            title={diffInfo.file_path}
          >
            {diffInfo.file_path}
            {diffInfo.is_new_file && (
              <span className="ml-1.5 rounded-sm bg-blue-500/15 px-1 py-0.5 text-[10px] text-blue-600">
                新文件
              </span>
            )}
          </CardTitle>
          <span className="shrink-0 rounded-sm bg-green-500/15 px-1.5 py-0.5 text-[10px] tabular-nums text-green-600">
            +{stats.added}
          </span>
          <span className="shrink-0 rounded-sm bg-red-500/15 px-1.5 py-0.5 text-[10px] tabular-nums text-red-600">
            -{stats.removed}
          </span>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
              badge.className,
            )}
          >
            {BadgeIcon && <BadgeIcon className={cn('h-3 w-3', isApplying && 'animate-spin')} />}
            <span>{badge.label}</span>
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="max-h-80 overflow-auto bg-zinc-950 font-mono text-xs">
          {rows.map((row, idx) => (
            <DiffRow key={`row-${idx}`} row={row} />
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex items-center gap-2 p-3">
        {isTerminal ? (
          <span className="text-xs text-muted-foreground">
            {applyStatus === 'applied' ? '改动已写入文件系统' : '已忽略本次改动'}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onApply}
              disabled={isApplying}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>{isApplying ? '应用中' : 'Accept'}</span>
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={isApplying}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              <span>Reject</span>
            </button>
          </>
        )}
        {applyStatus === 'error' && applyError && (
          <span className="ml-auto truncate text-xs text-red-600" title={applyError}>
            {applyError}
          </span>
        )}
      </CardFooter>
    </Card>
  )
}

/** 单行 diff 渲染 */
function DiffRow({ row }: { row: DiffRow }) {
  const isAdd = row.op === 'insert'
  const isDel = row.op === 'delete'
  return (
    <div
      className={cn(
        'flex',
        isAdd && 'bg-green-500/15',
        isDel && 'bg-red-500/15',
      )}
    >
      <span className="w-10 shrink-0 select-none px-2 text-right text-zinc-600">
        {row.oldNum ?? ''}
      </span>
      <span className="w-10 shrink-0 select-none px-2 text-right text-zinc-600">
        {row.newNum ?? ''}
      </span>
      <span
        className={cn(
          'w-4 shrink-0 text-center',
          isAdd && 'text-green-400',
          isDel && 'text-red-400',
          !isAdd && !isDel && 'text-zinc-600',
        )}
      >
        {isAdd ? '+' : isDel ? '-' : ''}
      </span>
      <span className="whitespace-pre pr-2 text-zinc-300">
        {isAdd ? row.newLine : row.oldLine}
      </span>
    </div>
  )
}

export default InlineDiffCard
