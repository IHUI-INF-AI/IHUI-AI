'use client'

import { MEMORY_TYPE_OPTIONS } from '@/lib/memory-api'
import type { MemoryEntryType } from '@ihui/types'
import { cn } from '@/lib/utils'

export type TypeFilter = MemoryEntryType | 'all'

interface MemoryTypeFilterProps {
  active: TypeFilter
  onChange: (type: TypeFilter) => void
}

const CHIPS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  ...MEMORY_TYPE_OPTIONS.map((o) => ({ value: o.value as TypeFilter, label: o.label })),
]

export function MemoryTypeFilter({ active, onChange }: MemoryTypeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {CHIPS.map((chip) => (
        <button
          key={chip.value}
          type="button"
          onClick={() => onChange(chip.value)}
          className={cn(
            'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
            active === chip.value
              ? 'border-border bg-card text-foreground'
              : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
