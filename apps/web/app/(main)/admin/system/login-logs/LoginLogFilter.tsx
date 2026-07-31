'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label } from '@ihui/ui-react'
import { inputCls } from './helpers'
import type { LoginLogSearch } from './types'

interface Props {
  search: LoginLogSearch
  setSearch: React.Dispatch<React.SetStateAction<LoginLogSearch>>
  onSearch: () => void
  onReset: () => void
}

export function LoginLogFilter({ search, setSearch, onSearch, onReset }: Props) {
  const t = useTranslations('admin.system')
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">{t('loginLogs.filter.user')}</Label>
        <Input
          value={search.userUuid}
          onChange={(e) => setSearch({ ...search, userUuid: e.target.value })}
          placeholder={t('loginLogs.filter.userPlaceholder')}
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t('loginLogs.filter.platform')}</Label>
        <Input
          value={search.platform}
          onChange={(e) => setSearch({ ...search, platform: e.target.value })}
          placeholder={t('loginLogs.filter.platformPlaceholder')}
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t('loginLogs.filter.location')}</Label>
        <Input
          value={search.location}
          onChange={(e) => setSearch({ ...search, location: e.target.value })}
          placeholder={t('loginLogs.filter.locationPlaceholder')}
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t('loginLogs.filter.startDate')}</Label>
        <Input
          type="date"
          value={search.startTime}
          onChange={(e) => setSearch({ ...search, startTime: e.target.value })}
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t('loginLogs.filter.endDate')}</Label>
        <Input
          type="date"
          value={search.endTime}
          onChange={(e) => setSearch({ ...search, endTime: e.target.value })}
          className={inputCls}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSearch}>
          <Search className="h-4 w-4" />
          {t('common.search')}
        </Button>
        <Button size="sm" variant="outline" onClick={onReset}>
          {t('common.reset')}
        </Button>
      </div>
    </div>
  )
}
