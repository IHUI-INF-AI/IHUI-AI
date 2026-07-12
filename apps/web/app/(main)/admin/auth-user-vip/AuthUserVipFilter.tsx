'use client'

import { Search } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui'
import type { AuthUserVipSearch } from './types'

interface Props {
  search: AuthUserVipSearch
  onSearchChange: (patch: Partial<AuthUserVipSearch>) => void
  onReset: () => void
  onQuery: () => void
}

export function AuthUserVipFilter({ search, onSearchChange, onReset, onQuery }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">用户UUID</Label>
        <Input
          className="h-9 w-40"
          value={search.userUuid}
          onChange={(e) => onSearchChange({ userUuid: e.target.value })}
          placeholder="搜索 UUID"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">VIP ID</Label>
        <Input
          className="h-9 w-40"
          value={search.vipId}
          onChange={(e) => onSearchChange({ vipId: e.target.value })}
          placeholder="搜索 VIP ID"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">进度</Label>
        <Input
          className="h-9 w-40"
          value={search.progress}
          onChange={(e) => onSearchChange({ progress: e.target.value })}
          placeholder="搜索进度"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">是否有效</Label>
        <Input
          className="h-9 w-40"
          value={search.isValid}
          onChange={(e) => onSearchChange({ isValid: e.target.value })}
          placeholder="0/1"
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
