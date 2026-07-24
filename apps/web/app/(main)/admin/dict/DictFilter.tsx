'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'

import { Input } from '@ihui/ui-react'

interface DictFilterProps {
  search: string
  onSearchChange: (v: string) => void
}

export function DictFilter({ search, onSearchChange }: DictFilterProps) {
  const t = useTranslations('adminTools')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('dict.searchPlaceholder')}
          className="h-9 pl-8"
        />
      </div>
    </div>
  )
}
