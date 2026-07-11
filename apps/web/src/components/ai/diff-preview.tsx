'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface DiffPreviewProps {
  oldContent: string
  newContent: string
  language?: string
  filename?: string
}

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

export function DiffPreview({ oldContent, newContent, language, filename }: DiffPreviewProps) {
  const rows = React.useMemo(
    () => computeLcsDiff(oldContent.split('\n'), newContent.split('\n')),
    [oldContent, newContent],
  )

  return (
    <div className="overflow-hidden rounded-lg border bg-zinc-950">
      {(filename || language) && (
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
          {filename && <span className="text-xs font-medium text-zinc-300">{filename}</span>}
          {language && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {language}
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 text-xs">
        <div className="border-r border-zinc-800">
          <div className="border-b border-zinc-800 bg-zinc-900 px-3 py-1 text-center text-zinc-500">
            旧版本
          </div>
          <div className="font-mono">
            {rows.map((row, idx) => (
              <div
                key={`old-${idx}`}
                className={cn(
                  'flex px-2',
                  row.op === 'delete' ? 'bg-red-500/15' : row.op === 'equal' ? '' : 'opacity-40',
                )}
              >
                <span className="w-10 shrink-0 select-none text-right text-zinc-600">
                  {row.oldNum ?? ''}
                </span>
                <span className="whitespace-pre px-2 text-zinc-300">
                  {row.op === 'insert' ? '' : (row.oldLine ?? '')}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="border-b border-zinc-800 bg-zinc-900 px-3 py-1 text-center text-zinc-500">
            新版本
          </div>
          <div className="font-mono">
            {rows.map((row, idx) => (
              <div
                key={`new-${idx}`}
                className={cn(
                  'flex px-2',
                  row.op === 'insert' ? 'bg-green-500/15' : row.op === 'equal' ? '' : 'opacity-40',
                )}
              >
                <span className="w-10 shrink-0 select-none text-right text-zinc-600">
                  {row.newNum ?? ''}
                </span>
                <span className="whitespace-pre px-2 text-zinc-300">
                  {row.op === 'delete' ? '' : (row.newLine ?? '')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DiffPreview
