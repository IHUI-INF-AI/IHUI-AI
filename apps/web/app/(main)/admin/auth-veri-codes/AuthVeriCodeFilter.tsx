'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label } from '@ihui/ui'
import type { AuthVeriCodeSearch } from './types'

interface Props {
  search: AuthVeriCodeSearch
  onSearchChange: (patch: Partial<AuthVeriCodeSearch>) => void
  onQuery: () => void
  onReset: () => void
}

export function AuthVeriCodeFilter({ search, onSearchChange, onQuery, onReset }: Props) {
  const t = useTranslations('adminAuthVeriCode')
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">{t('labelUserId')}</Label>
        <Input
          className="h-9 w-40"
          value={search.userId}
          onChange={(e) => onSearchChange({ userId: e.target.value })}
          placeholder={t('phUserId')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelPhone')}</Label>
        <Input
          className="h-9 w-40"
          value={search.phone}
          onChange={(e) => onSearchChange({ phone: e.target.value })}
          placeholder={t('phPhone')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelPlatform')}</Label>
        <Input
          className="h-9 w-40"
          value={search.platform}
          onChange={(e) => onSearchChange({ platform: e.target.value })}
          placeholder={t('phPlatform')}
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
