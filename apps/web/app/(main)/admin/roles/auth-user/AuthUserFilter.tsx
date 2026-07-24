'use client'

import { Search } from 'lucide-react'

import { Button, Input, Label } from '@ihui/ui-react'
import { inputCls } from './helpers'

interface AuthUserFilterProps {
  search: { userName: string; phonenumber: string }
  onSearchChange: (v: { userName: string; phonenumber: string }) => void
  onSearch: () => void
}

export function AuthUserFilter({ search, onSearchChange, onSearch }: AuthUserFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">用户名</Label>
        <Input
          value={search.userName}
          onChange={(e) => onSearchChange({ ...search, userName: e.target.value })}
          placeholder="用户名"
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">手机号</Label>
        <Input
          value={search.phonenumber}
          onChange={(e) => onSearchChange({ ...search, phonenumber: e.target.value })}
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
