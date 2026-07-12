'use client'

import { Search } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui'
import { DatePicker } from '@/components/form/DatePicker'
import type { LoginLogSearch } from './types'

interface Props {
  search: LoginLogSearch
  onSearchChange: (patch: Partial<LoginLogSearch>) => void
  onReset: () => void
  onQuery: () => void
}

export function LoginLogFilter({ search, onSearchChange, onReset, onQuery }: Props) {
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
        <Label className="text-xs">平台</Label>
        <Input
          className="h-9 w-40"
          value={search.platform}
          onChange={(e) => onSearchChange({ platform: e.target.value })}
          placeholder="搜索平台"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">位置</Label>
        <Input
          className="h-9 w-40"
          value={search.location}
          onChange={(e) => onSearchChange({ location: e.target.value })}
          placeholder="搜索位置"
        />
      </div>
      <div className="space-y-1">
        <DatePicker
          label="登录时间"
          value={search.loginTime}
          onChange={(v) => onSearchChange({ loginTime: v })}
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
