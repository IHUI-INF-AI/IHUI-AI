'use client'

import { Search } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui'
import type { AuthVeriCodeSearch } from './types'

interface Props {
  search: AuthVeriCodeSearch
  onSearchChange: (patch: Partial<AuthVeriCodeSearch>) => void
  onQuery: () => void
  onReset: () => void
}

export function AuthVeriCodeFilter({ search, onSearchChange, onQuery, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">用户ID</Label>
        <Input
          className="h-9 w-40"
          value={search.userId}
          onChange={(e) => onSearchChange({ userId: e.target.value })}
          placeholder="搜索用户ID"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">手机号</Label>
        <Input
          className="h-9 w-40"
          value={search.phone}
          onChange={(e) => onSearchChange({ phone: e.target.value })}
          placeholder="搜索手机号"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">平台</Label>
        <Input
          className="h-9 w-40"
          value={search.platform}
          onChange={(e) => onSearchChange({ platform: e.target.value })}
          placeholder="搜索平台"
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
