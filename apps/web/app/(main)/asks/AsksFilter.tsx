'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { Filter } from './types'

interface Props {
  search: string
  setSearch: (v: string) => void
  filter: Filter
  setFilter: (v: Filter) => void
}

export function AsksFilter({ search, setSearch, filter, setFilter }: Props) {
  const t = useTranslations('asks')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
        />
      </div>
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        {(['all', 'unresolved', 'resolved'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === f
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(f === 'all' ? 'all' : f === 'resolved' ? 'resolved' : 'unresolved')}
          </button>
        ))}
      </div>
    </div>
  )
}
