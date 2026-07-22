'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { X, GitCompare, Trash2 } from 'lucide-react'
import type { LeaderboardEntry } from '@/lib/ai-news-api'

interface Props {
  entries: LeaderboardEntry[]
  onRemove: (id: string) => void
  onClear: () => void
  onCompare: () => void
}

/** 底部对比栏:显示已选模型 chip + 清空/对比按钮 */
export function ModelCompareBar({ entries, onRemove, onClear, onCompare }: Props) {
  const t = useTranslations('aiNews')

  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 bg-primary/5 px-4 py-2.5 backdrop-blur">
      <GitCompare className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {t('compare.selected', { count: entries.length })}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {entries.map((e) => (
          <span
            key={e.id}
            className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-0.5 text-xs shadow-sm"
          >
            <span className="max-w-[120px] truncate">{e.modelName}</span>
            <button
              type="button"
              onClick={() => onRemove(e.id)}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Trash2 className="h-3 w-3" />
        {t('compare.clear')}
      </button>
      <button
        type="button"
        onClick={onCompare}
        disabled={entries.length < 2}
        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <GitCompare className="h-3 w-3" />
        {t('compare.startCompare')}
      </button>
    </div>
  )
}
