'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui-react'
import { STATUS_TABS, inputClass } from './helpers'

interface RefundFilterProps {
  status: string
  searchInput: string
  onStatusChange: (v: string) => void
  onSearchInputChange: (v: string) => void
  onSearch: (e: React.FormEvent) => void
}

export function RefundFilter({
  status,
  searchInput,
  onStatusChange,
  onSearchInputChange,
  onSearch,
}: RefundFilterProps) {
  const t = useTranslations('admin.refund')

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {STATUS_TABS.map((tb) => (
          <button
            key={tb.value}
            onClick={() => onStatusChange(tb.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              status === tb.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`status_${tb.labelKey}`)}
          </button>
        ))}
      </div>

      <form onSubmit={onSearch} className="flex items-center gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className={inputClass}
        />
        <Button type="submit" variant="outline" size="sm">
          {t('search')}
        </Button>
      </form>
    </>
  )
}
