/**
 * P1-2.2: 租户筛选器(搜索 + 状态)
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Input } from '@ihui/ui'

import { selectClass } from '../helpers'

interface TenantFilterProps {
  search: string
  onSearchChange: (v: string) => void
  state: string
  onStateChange: (v: string) => void
}

export function TenantFilter({
  search,
  onSearchChange,
  state,
  onStateChange,
}: TenantFilterProps) {
  const t = useTranslations('admin.saas')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative max-w-xs flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="h-9 pl-8"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('search')}
        />
      </div>
      <select
        className={selectClass}
        value={state}
        onChange={(e) => onStateChange(e.target.value)}
        aria-label={t('filterState')}
      >
        <option value="all">{t('stateAll')}</option>
        <option value="active">{t('stateActive')}</option>
        <option value="paused">{t('statePaused')}</option>
        <option value="creating">{t('stateCreating')}</option>
        <option value="not-found">{t('stateNotFound')}</option>
      </select>
    </div>
  )
}
