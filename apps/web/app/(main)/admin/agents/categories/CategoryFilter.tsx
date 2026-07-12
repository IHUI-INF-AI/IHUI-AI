'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Input } from '@ihui/ui'

interface CategoryFilterProps {
  value: string
  onChange: (v: string) => void
}

export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  const t = useTranslations('admin.agents.categories')
  const tc = useTranslations('common')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
          aria-label={tc('search')}
        />
      </div>
    </div>
  )
}
