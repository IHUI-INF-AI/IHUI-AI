'use client'

import { Search } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui'
import type { AuthFindInfoSearch } from './types'

interface Props {
  search: AuthFindInfoSearch
  onSearchChange: (patch: Partial<AuthFindInfoSearch>) => void
  onQuery: () => void
  onReset: () => void
}

export function AuthFindInfoFilter({ search, onSearchChange, onQuery, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">用户UUID</Label>
        <Input
          className="h-9 w-48"
          value={search.userUuid}
          onChange={(e) => onSearchChange({ userUuid: e.target.value })}
          placeholder="搜索 UUID"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">银行卡号</Label>
        <Input
          className="h-9 w-48"
          value={search.card}
          onChange={(e) => onSearchChange({ card: e.target.value })}
          placeholder="搜索卡号"
        />
      </div>
      <Button size="sm" onClick={onQuery}>
        <Search className="h-4 w-4" />
        搜索
      </Button>
      <Button variant="outline" size="sm" onClick={onReset}>
        重置
      </Button>
    </div>
  )
}
