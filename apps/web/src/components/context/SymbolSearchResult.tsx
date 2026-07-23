'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { SymbolResult } from '@ihui/shared/context/index'

interface SymbolSearchResultProps {
  symbol: SymbolResult
  selected?: boolean
  onSelect?: (s: SymbolResult) => void
}

const KIND_BADGE: Record<SymbolResult['kind'], string> = {
  function: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  interface: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  type: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  variable: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  constant: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
}

const KIND_LABEL: Record<SymbolResult['kind'], string> = {
  function: 'fn',
  class: 'class',
  interface: 'iface',
  type: 'type',
  variable: 'var',
  constant: 'const',
}

export function SymbolSearchResult({
  symbol,
  selected,
  onSelect,
}: SymbolSearchResultProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(symbol)}
      className={cn(
        'flex w-full items-start gap-2 rounded-md border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/60',
        selected && 'border-primary/40 bg-accent',
      )}
    >
      <span
        className={cn(
          'mt-0.5 shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase',
          KIND_BADGE[symbol.kind],
        )}
      >
        {KIND_LABEL[symbol.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{symbol.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {symbol.filePath}:{symbol.line}
        </p>
        {symbol.detail && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{symbol.detail}</p>
        )}
      </div>
    </button>
  )
}
