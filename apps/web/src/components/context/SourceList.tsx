'use client'

import * as React from 'react'
import { Database, File, Folder, Globe, Code2 } from 'lucide-react'
import { Switch } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { ContextSource, ContextType } from '@ihui/shared/context/index'

const TYPE_ICON: Record<ContextType, React.ComponentType<{ className?: string }>> = {
  file: File as React.ComponentType<{ className?: string }>,
  folder: Folder as React.ComponentType<{ className?: string }>,
  symbol: Code2 as React.ComponentType<{ className?: string }>,
  database: Database as React.ComponentType<{ className?: string }>,
  web: Globe as React.ComponentType<{ className?: string }>,
}

const TYPE_COLOR: Record<ContextType, string> = {
  file: 'text-slate-600 dark:text-slate-300',
  folder: 'text-slate-600 dark:text-slate-300',
  symbol: 'text-indigo-600 dark:text-indigo-400',
  database: 'text-emerald-600 dark:text-emerald-400',
  web: 'text-blue-600 dark:text-blue-400',
}

interface SourceListProps {
  sources: ContextSource[]
  onToggle?: (type: ContextType, enabled: boolean) => void
  onBudgetChange?: (type: ContextType, percent: number) => void
  className?: string
}

export function SourceList({
  sources,
  onToggle,
  onBudgetChange,
  className,
}: SourceListProps) {
  const enabledTotal = sources
    .filter((s) => s.enabled)
    .reduce((s, x) => s + x.budgetPercent, 0)

  return (
    <div className={cn('space-y-2', className)}>
      {sources.map((s) => {
        const Icon = TYPE_ICON[s.type]
        return (
          <div
            key={s.type}
            className="flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:bg-accent/40"
          >
            <Icon className={cn('h-4 w-4 shrink-0', TYPE_COLOR[s.type])} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{s.label}</p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {s.budgetPercent}%
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{s.description}</p>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={s.budgetPercent}
                disabled={!s.enabled}
                onChange={(e) => onBudgetChange?.(s.type, Number(e.target.value))}
                className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-sm bg-muted accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`${s.label} 预算百分比`}
              />
            </div>
            <Switch
              checked={s.enabled}
              onCheckedChange={(v) => onToggle?.(s.type, v)}
              aria-label={`切换 ${s.label} 启用状态`}
            />
          </div>
        )
      })}
      <p className="px-1 text-xs text-muted-foreground">
        已启用源合计预算:
        <span className="ml-1 font-medium tabular-nums">{enabledTotal}%</span>
      </p>
    </div>
  )
}
