'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui'
import { inputCls } from './helpers'
import type { LoginLogSearch } from './types'

interface Props {
  search: LoginLogSearch
  setSearch: React.Dispatch<React.SetStateAction<LoginLogSearch>>
  onSearch: () => void
  onReset: () => void
}

export function LoginLogFilter({ search, setSearch, onSearch, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">用户</Label>
        <Input
          value={search.userUuid}
          onChange={(e) => setSearch({ ...search, userUuid: e.target.value })}
          placeholder="用户标识"
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">平台</Label>
        <Input
          value={search.platform}
          onChange={(e) => setSearch({ ...search, platform: e.target.value })}
          placeholder="平台"
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">位置</Label>
        <Input
          value={search.location}
          onChange={(e) => setSearch({ ...search, location: e.target.value })}
          placeholder="登录位置"
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">开始日期</Label>
        <Input
          type="date"
          value={search.startTime}
          onChange={(e) => setSearch({ ...search, startTime: e.target.value })}
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">结束日期</Label>
        <Input
          type="date"
          value={search.endTime}
          onChange={(e) => setSearch({ ...search, endTime: e.target.value })}
          className={inputCls}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSearch}>
          <Search className="h-4 w-4" />
          搜索
        </Button>
        <Button size="sm" variant="outline" onClick={onReset}>
          重置
        </Button>
      </div>
    </div>
  )
}
