'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@ihui/ui-react'

interface Props {
  search: string
  setSearch: (v: string) => void
}

export function ResourceTagFilter({ search, setSearch }: Props) {
  const t = useTranslations('admin.resources')
  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="h-9 pl-8"
        aria-label={t('search')}
      />
    </div>
  )
}
