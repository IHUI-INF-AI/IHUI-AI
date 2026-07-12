'use client'

import { Search } from 'lucide-react'

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
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">用户UUID</Label>
        <Input
          className="h-9 w-40"
          value={search.userUuid}
          onChange={(e) => onSearchChange({ ...search, userUuid: e.target.value })}
          placeholder="搜索 UUID"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">平台</Label>
        <Input
          className="h-9 w-40"
          value={search.platform}
          onChange={(e) => onSearchChange({ ...search, platform: e.target.value })}
          placeholder="搜索平台"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">OpenID</Label>
        <Input
          className="h-9 w-40"
          value={search.openId}
          onChange={(e) => onSearchChange({ ...search, openId: e.target.value })}
          placeholder="搜索 OpenID"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">平台名称</Label>
        <Input
          className="h-9 w-40"
          value={search.platformName}
          onChange={(e) => onSearchChange({ ...search, platformName: e.target.value })}
          placeholder="搜索平台名称"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">昵称</Label>
        <Input
          className="h-9 w-40"
          value={search.nickname}
          onChange={(e) => onSearchChange({ ...search, nickname: e.target.value })}
          placeholder="搜索昵称"
        />
      </div>
      <Button size="sm" onClick={onSearch}>
        <Search className="h-4 w-4" />
        搜索
      </Button>
      <Button variant="outline" size="sm" onClick={onReset}>
        重置
      </Button>
    </div>
  )
}
