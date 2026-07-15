'use client'

import { HelpCircle, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input } from '@ihui/ui'

interface Props {
  search: string
  setSearch: (v: string) => void
  onCreate: () => void
  mockMode: boolean
}

export function AsksFilter({ search, setSearch, onCreate, mockMode }: Props) {
  const t = useTranslations('admin.asks')
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <HelpCircle className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 w-64"
          aria-label={t('searchPlaceholder')}
        />
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>
      {mockMode && (
        <div className="w-full rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          ⚠ {t('mockMode')}
        </div>
      )}
    </div>
  )
}
