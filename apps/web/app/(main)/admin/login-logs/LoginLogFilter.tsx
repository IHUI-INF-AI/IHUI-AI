'use client'

import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui-react'
import { DatePicker } from '@/components/form/DatePicker'
import type { LoginLogSearch } from './types'

interface Props {
  search: LoginLogSearch
  onSearchChange: (patch: Partial<LoginLogSearch>) => void
  onReset: () => void
  onQuery: () => void
}

export function LoginLogFilter({ search, onSearchChange, onReset, onQuery }: Props) {
  const t = useTranslations('admin.loginLogs')
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">{t('labelUserUuid')}</Label>
        <Input
          className="h-9 w-40"
          value={search.userUuid}
          onChange={(e) => onSearchChange({ userUuid: e.target.value })}
          placeholder={t('placeholderUserUuid')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelPlatform')}</Label>
        <Input
          className="h-9 w-40"
          value={search.platform}
          onChange={(e) => onSearchChange({ platform: e.target.value })}
          placeholder={t('placeholderPlatform')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelLocation')}</Label>
        <Input
          className="h-9 w-40"
          value={search.location}
          onChange={(e) => onSearchChange({ location: e.target.value })}
          placeholder={t('placeholderLocation')}
        />
      </div>
      <div className="space-y-1">
        <DatePicker
          label={t('labelLoginTime')}
          value={search.loginTime}
          onChange={(v) => onSearchChange({ loginTime: v })}
        />
      </div>
      <Button size="sm" onClick={onQuery}>
        <Search className="h-4 w-4" />
        {t('search')}
      </Button>
      <Button variant="outline" size="sm" onClick={onReset}>
        {t('reset')}
      </Button>
    </div>
  )
}
