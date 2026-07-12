'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label } from '@ihui/ui'
import type { AuthUserVipSearch } from './types'

interface Props {
  search: AuthUserVipSearch
  onSearchChange: (patch: Partial<AuthUserVipSearch>) => void
  onReset: () => void
  onQuery: () => void
}

export function AuthUserVipFilter({ search, onSearchChange, onReset, onQuery }: Props) {
  const t = useTranslations('adminAuthUserVip')
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">{t('labelUserUuid')}</Label>
        <Input
          className="h-9 w-40"
          value={search.userUuid}
          onChange={(e) => onSearchChange({ userUuid: e.target.value })}
          placeholder={t('phUserUuid')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelVipId')}</Label>
        <Input
          className="h-9 w-40"
          value={search.vipId}
          onChange={(e) => onSearchChange({ vipId: e.target.value })}
          placeholder={t('phVipId')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelProgress')}</Label>
        <Input
          className="h-9 w-40"
          value={search.progress}
          onChange={(e) => onSearchChange({ progress: e.target.value })}
          placeholder={t('phProgress')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelIsValid')}</Label>
        <Input
          className="h-9 w-40"
          value={search.isValid}
          onChange={(e) => onSearchChange({ isValid: e.target.value })}
          placeholder="0/1"
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
