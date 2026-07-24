'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui-react'
import { STATUS_OPTIONS, selectClass } from './helpers'

interface AgentsFilterProps {
  search: string
  status: string
  onSearchChange: (v: string) => void
  onStatusChange: (v: string) => void
}

export function AgentsFilter({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: AgentsFilterProps) {
  const t = useTranslations('admin.agents')
  const tc = useTranslations('common')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
          aria-label={tc('search')}
        />
      </div>
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className={selectClass} aria-label={t('fieldStatus')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStatus')}</SelectItem>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`status${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
