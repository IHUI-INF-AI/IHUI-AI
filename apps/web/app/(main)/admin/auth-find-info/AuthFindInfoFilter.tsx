'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label } from '@ihui/ui'
import type { AuthFindInfoSearch } from './types'

interface Props {
  search: AuthFindInfoSearch
  onSearchChange: (patch: Partial<AuthFindInfoSearch>) => void
  onQuery: () => void
  onReset: () => void
}

export function AuthFindInfoFilter({ search, onSearchChange, onQuery, onReset }: Props) {
  const t = useTranslations('adminAuthFindInfo')
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">{t('labelUserUuid')}</Label>
        <Input
          className="h-9 w-48"
          value={search.userUuid}
          onChange={(e) => onSearchChange({ userUuid: e.target.value })}
          placeholder={t('phUserUuid')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelCard')}</Label>
        <Input
          className="h-9 w-48"
          value={search.card}
          onChange={(e) => onSearchChange({ card: e.target.value })}
          placeholder={t('phCard')}
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
