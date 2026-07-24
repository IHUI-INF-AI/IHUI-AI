'use client'

import { Input } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { RANGES, type Range } from './helpers'

interface Props {
  range: Range
  customFrom: string
  customTo: string
  t: (k: string) => string
  onRange: (r: Range) => void
  onCustomFrom: (v: string) => void
  onCustomTo: (v: string) => void
}

export function TokenValueFilters({ range, customFrom, customTo, t, onRange, onCustomFrom, onCustomTo }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border p-0.5">
        {RANGES.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onRange(opt.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              range === opt.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
      {range === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFrom(e.target.value)}
            className="h-8 w-[140px]"
          />
          <span className="text-xs text-muted-foreground">~</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => onCustomTo(e.target.value)}
            className="h-8 w-[140px]"
          />
        </div>
      )}
    </div>
  )
}
