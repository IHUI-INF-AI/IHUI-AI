'use client'

import { MEMORY_SCOPE_OPTIONS } from '@/lib/memory-api'
import type { MemoryScope } from '@ihui/types'
import { cn } from '@/lib/utils'

export type ScopeFilter = MemoryScope | 'all'

interface MemoryScopeTabsProps {
  active: ScopeFilter
  onChange: (scope: ScopeFilter) => void
}

const TABS: { value: ScopeFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  ...MEMORY_SCOPE_OPTIONS.map((o) => ({ value: o.value as ScopeFilter, label: o.label })),
]

export function MemoryScopeTabs({ active, onChange }: MemoryScopeTabsProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
            active === tab.value
              ? 'border-border bg-card text-foreground'
              : 'border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
