'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { selectClass } from './helpers'
import type { LevelItem } from './types'

interface Props {
  search: string
  setSearch: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  levelFilter: string
  setLevelFilter: (v: string) => void
  levels: LevelItem[] | undefined
}

export function MembersFilter({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  levelFilter,
  setLevelFilter,
  levels,
}: Props) {
  const t = useTranslations('members')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          className="h-9 pl-8"
          aria-label={t('search')}
        />
      </div>
      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
        <SelectTrigger className={selectClass} aria-label={t('status')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStatus')}</SelectItem>
          <SelectItem value="1">{t('statusActive')}</SelectItem>
          <SelectItem value="0">{t('statusPending')}</SelectItem>
          <SelectItem value="2">{t('statusSealed')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v)}>
        <SelectTrigger className={selectClass} aria-label={t('level')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allLevels')}</SelectItem>
          {(levels ?? []).map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
