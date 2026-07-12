'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui'

import { inputCls } from './helpers'
import type { SearchState } from './types'

interface Props {
  search: SearchState
  setSearch: React.Dispatch<React.SetStateAction<SearchState>>
  onSearch: () => void
}

export function SelectUserFilter({ search, setSearch, onSearch }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">用户名</Label>
        <Input
          value={search.userName}
          onChange={(e) => setSearch({ ...search, userName: e.target.value })}
          placeholder="用户名"
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">手机号</Label>
        <Input
          value={search.phonenumber}
          onChange={(e) => setSearch({ ...search, phonenumber: e.target.value })}
          placeholder="手机号"
          className={inputCls}
        />
      </div>
      <Button size="sm" onClick={onSearch}>
        <Search className="h-4 w-4" />
        搜索
      </Button>
    </div>
  )
}
