'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import type { DiffFileStatus } from '@ihui/types'
import { cn } from '@/lib/utils'
import { Columns2, Rows2, Plus, Minus, GitCommit } from 'lucide-react'

export type DiffFilterType = DiffFileStatus | 'all'

interface DiffStatsBarProps {
  filter?: DiffFilterType
  onFilterChange?: (filter: DiffFilterType) => void
  onCommit?: () => void
}

const FILTER_OPTIONS: { value: DiffFilterType; labelKey: string }[] = [
  { value: 'all', labelKey: 'diffStats.filterAll' },
  { value: 'modified', labelKey: 'diffStats.filterModified' },
  { value: 'added', labelKey: 'diffStats.filterAdded' },
  { value: 'deleted', labelKey: 'diffStats.filterDeleted' },
]

export function DiffStatsBar({ filter = 'all', onFilterChange, onCommit }: DiffStatsBarProps) {
  const { diffFiles, diffViewMode, setDiffViewMode } = useIDEWorkspace()
  const t = useTranslations('ide')
  const totalAdd = diffFiles.reduce((s, f) => s + f.additions, 0)
  const totalDel = diffFiles.reduce((s, f) => s + f.deletions, 0)
  const total = totalAdd + totalDel
  const addPct = total > 0 ? (totalAdd / total) * 100 : 50

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 text-xs">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setDiffViewMode('split')}
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors',
            diffViewMode === 'split' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Columns2 className="h-3.5 w-3.5" />
          <span>{t('diffStats.split')}</span>
        </button>
        <button
          onClick={() => setDiffViewMode('unified')}
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors',
            diffViewMode === 'unified' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Rows2 className="h-3.5 w-3.5" />
          <span>{t('diffStats.unified')}</span>
        </button>
      </div>
      <div className="flex h-1.5 w-20 overflow-hidden rounded-sm bg-muted">
        <div className="h-full bg-green-500/70" style={{ width: `${addPct}%` }} />
        <div className="h-full bg-red-500/70" style={{ width: `${100 - addPct}%` }} />
      </div>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
          <Plus className="h-3 w-3" />{totalAdd}
        </span>
        <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
          <Minus className="h-3 w-3" />{totalDel}
        </span>
      </div>
      <span className="text-muted-foreground">{t('diffStats.fileCount', { count: diffFiles.length })}</span>
      {onFilterChange && (
        <div className="flex items-center gap-0.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFilterChange(opt.value)}
              className={cn(
                'rounded px-1.5 py-0.5 transition-colors',
                filter === opt.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span>{t(opt.labelKey)}</span>
            </button>
          ))}
        </div>
      )}
      {onCommit && (
        <button
          onClick={onCommit}
          className="ml-auto flex items-center gap-1 rounded bg-foreground px-2 py-0.5 text-background transition-colors hover:bg-foreground/90"
        >
          <GitCommit className="h-3 w-3" />
          <span>{t('diffStats.commit')}</span>
        </button>
      )}
    </div>
  )
}
