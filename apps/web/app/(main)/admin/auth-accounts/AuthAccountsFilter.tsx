'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button, Input, Label } from '@ihui/ui'
import type { AuthAccountSearch } from './types'

interface AuthAccountsFilterProps {
  search: AuthAccountSearch
  onSearchChange: (search: AuthAccountSearch) => void
  onSearch: () => void
  onReset: () => void
}

export function AuthAccountsFilter({
  search,
  onSearchChange,
  onSearch,
  onReset,
}: AuthAccountsFilterProps) {
  const t = useTranslations('adminAuthAccounts')
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">{t('labelUserUuid')}</Label>
        <Input
          className="h-9 w-40"
          value={search.userUuid}
          onChange={(e) => onSearchChange({ ...search, userUuid: e.target.value })}
          placeholder={t('phUserUuid')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelPlatform')}</Label>
        <Input
          className="h-9 w-40"
          value={search.platform}
          onChange={(e) => onSearchChange({ ...search, platform: e.target.value })}
          placeholder={t('phPlatform')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelOpenId')}</Label>
        <Input
          className="h-9 w-40"
          value={search.openId}
          onChange={(e) => onSearchChange({ ...search, openId: e.target.value })}
          placeholder={t('phOpenId')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelPlatformName')}</Label>
        <Input
          className="h-9 w-40"
          value={search.platformName}
          onChange={(e) => onSearchChange({ ...search, platformName: e.target.value })}
          placeholder={t('phPlatformName')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('labelNickname')}</Label>
        <Input
          className="h-9 w-40"
          value={search.nickname}
          onChange={(e) => onSearchChange({ ...search, nickname: e.target.value })}
          placeholder={t('phNickname')}
        />
      </div>
      <Button size="sm" onClick={onSearch}>
        <Search className="h-4 w-4" />
        {t('search')}
      </Button>
      <Button variant="outline" size="sm" onClick={onReset}>
        {t('reset')}
      </Button>
    </div>
  )
}
