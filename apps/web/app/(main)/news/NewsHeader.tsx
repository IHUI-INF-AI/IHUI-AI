'use client'

import { Newspaper, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@ihui/ui'

interface Props {
  search: string
  onSearchChange: (v: string) => void
}

export function NewsHeader({ search, onSearchChange }: Props) {
  const t = useTranslations('news')

  return (
    <>
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Newspaper className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('search')}
          className="h-9 pl-8"
          aria-label={t('search')}
        />
      </div>
    </>
  )
}
