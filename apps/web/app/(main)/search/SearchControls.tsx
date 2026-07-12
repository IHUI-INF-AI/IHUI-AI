'use client'

import { useTranslations } from 'next-intl'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { TABS } from './helpers'
import type { TabKey, SortKey } from './types'

interface Props {
  tab: TabKey
  setTab: (v: TabKey) => void
  sort: SortKey
  setSort: (v: SortKey) => void
}

export function SearchControls({ tab, setTab, sort, setSort }: Props) {
  const t = useTranslations('search')
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.value}
            onClick={() => setTab(tabItem.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === tabItem.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tabs.${tabItem.labelKey}`)}
          </button>
        ))}
      </div>
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        {t('sort')}
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="rounded-md border bg-background px-2 py-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">{t('sortRelevance')}</SelectItem>
            <SelectItem value="time">{t('sortTime')}</SelectItem>
            <SelectItem value="name">{t('sortName')}</SelectItem>
            <SelectItem value="size">{t('sortSize')}</SelectItem>
          </SelectContent>
        </Select>
      </label>
    </div>
  )
}
