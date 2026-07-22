'use client'
import * as React from 'react'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import type { DiffFile } from '@ihui/types'
import { DiffStatsBar, type DiffFilterType } from './diff-stats-bar'
import { DiffFileList } from './diff-file-list'
import { DiffPreview } from '@/components/ai/diff-preview'
import { InlineDiffViewer } from '@/components/ai/inline-diff-viewer'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, ChevronUp, Maximize2, Minimize2, Plus, Minus } from 'lucide-react'

export function DiffViewerPane() {
  const { diffFiles, activeDiffFileId, diffViewMode, setActiveDiffFile } = useIDEWorkspace()
  const [showFileList, setShowFileList] = React.useState(true)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [filter, setFilter] = React.useState<DiffFilterType>('all')
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  const activeIdx = diffFiles.findIndex((f) => f.id === activeDiffFileId)
  const activeDiff = activeIdx >= 0 ? diffFiles[activeIdx] : undefined
  const showList = showFileList && !isFullscreen

  const goPrev = () => {
    const prev = diffFiles[activeIdx - 1]
    if (prev) setActiveDiffFile(prev.id)
  }
  const goNext = () => {
    const next = diffFiles[activeIdx + 1]
    if (next) setActiveDiffFile(next.id)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DiffStatsBar
        filter={filter}
        onFilterChange={setFilter}
        onCommit={() => setSelectedIds(new Set())}
      />
      <div className="flex min-h-0 flex-1">
        {showList && (
          <div className="w-56 shrink-0 overflow-auto bg-muted/20 p-1">
            <DiffFileList
              filter={filter}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              showActions
            />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1 text-xs">
            <button onClick={() => setShowFileList(!showFileList)} className="flex items-center rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground">{showFileList ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</button>
            <span className="truncate text-muted-foreground">{activeDiff?.filename ?? '选择文件'}</span>
            {activeDiff && (
              <div className="flex items-center gap-0.5">
                <button onClick={goPrev} disabled={activeIdx <= 0} className="rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                <button onClick={goNext} disabled={activeIdx >= diffFiles.length - 1} className="rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                <span className="text-muted-foreground">{activeIdx + 1}/{diffFiles.length}</span>
              </div>
            )}
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground">{isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}</button>
          </div>
          {activeDiff && <ChangeSummary file={activeDiff} />}
          <div className="flex-1 overflow-auto">
            {activeDiff && diffViewMode === 'split' && (
              <DiffPreview
                oldContent={activeDiff.oldContent}
                newContent={activeDiff.newContent}
                language={activeDiff.language}
                filename={activeDiff.filename}
              />
            )}
            {activeDiff && diffViewMode === 'unified' && (
              <InlineDiffViewer
                content={generateUnifiedDiff(activeDiff.oldContent, activeDiff.newContent)}
                filename={activeDiff.filename}
              />
            )}
            {!activeDiff && (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                选择文件查看差异
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ChangeSummary({ file }: { file: DiffFile }) {
  const total = file.additions + file.deletions
  const pct = total > 0 ? Math.round((file.additions / total) * 100) : 0
  const blocks = React.useMemo(() => countChangeBlocks(file.oldContent, file.newContent), [file])
  const preview = React.useMemo(() => computeWordDiffPreview(file.oldContent, file.newContent), [file])

  return (
    <div className="flex flex-col gap-1 bg-muted/20 px-3 py-1.5 text-xs">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
          <Plus className="h-3 w-3" />{file.additions}
        </span>
        <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
          <Minus className="h-3 w-3" />{file.deletions}
        </span>
        <div className="flex items-center gap-1.5">
          <div className="flex h-1 w-16 overflow-hidden rounded-sm bg-muted">
            <div className="h-full bg-green-500/70" style={{ width: `${pct}%` }} />
            <div className="h-full bg-red-500/70" style={{ width: `${100 - pct}%` }} />
          </div>
          <span className="text-muted-foreground">{pct}% 新增</span>
        </div>
        <span className="text-muted-foreground">{blocks} 个变更块</span>
      </div>
      {preview && (
        <div className="flex flex-wrap items-center gap-0.5 font-mono text-[11px]">
          <span className="text-muted-foreground">词级变更:</span>
          {preview.map((tok, i) => (
            <span
              key={i}
              className={cn(
                'rounded-sm px-0.5',
                tok.type === 'add' && 'bg-green-500/20 text-green-600 dark:text-green-400',
                tok.type === 'del' && 'bg-red-500/20 text-red-600 dark:text-red-400 line-through',
              )}
            >
              {tok.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

type WordToken = { text: string; type: 'eq' | 'del' | 'add' }

function computeWordDiffPreview(oldContent: string, newContent: string): WordToken[] | null {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
    const ol = oldLines[i] ?? ''
    const nl = newLines[i] ?? ''
    if (ol !== nl && ol.trim() && nl.trim()) {
      return wordDiff(ol, nl).filter((t) => t.type !== 'eq').slice(0, 10)
    }
  }
  return null
}

function wordDiff(a: string, b: string): WordToken[] {
  const aw = a.split(/(\s+)/).filter((w) => w.length > 0)
  const bw = b.split(/(\s+)/).filter((w) => w.length > 0)
  const m = aw.length
  const n = bw.length
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    const row = dp[i]
    const nextRow = dp[i + 1]
    if (!row || !nextRow) continue
    for (let j = n - 1; j >= 0; j--) {
      if ((aw[i] ?? '') === (bw[j] ?? '')) {
        row[j] = (nextRow[j + 1] ?? 0) + 1
      } else {
        row[j] = Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0)
      }
    }
  }
  const result: WordToken[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    const ai = aw[i] ?? ''
    const bj = bw[j] ?? ''
    if (ai === bj) {
      result.push({ text: ai, type: 'eq' })
      i++
      j++
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      result.push({ text: ai, type: 'del' })
      i++
    } else {
      result.push({ text: bj, type: 'add' })
      j++
    }
  }
  while (i < m) result.push({ text: aw[i++] ?? '', type: 'del' })
  while (j < n) result.push({ text: bw[j++] ?? '', type: 'add' })
  return result
}

function countChangeBlocks(oldContent: string, newContent: string): number {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const maxLen = Math.max(oldLines.length, newLines.length)
  let blocks = 0
  let inBlock = false
  for (let i = 0; i < maxLen; i++) {
    const diff = (oldLines[i] ?? '') !== (newLines[i] ?? '')
    if (diff) {
      if (!inBlock) {
        blocks++
        inBlock = true
      }
    } else {
      inBlock = false
    }
  }
  return blocks
}

function generateUnifiedDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const result: string[] = []
  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    const ol = oldLines[i]
    const nl = newLines[i]
    if (ol === nl) result.push(nl ?? '')
    else {
      if (ol !== undefined) result.push(`-${ol}`)
      if (nl !== undefined) result.push(`+${nl}`)
    }
  }
  return result.join('\n')
}
