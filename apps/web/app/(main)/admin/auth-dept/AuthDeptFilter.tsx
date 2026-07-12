'use client'

import { Search } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui'

interface Props {
  userId: string
  onUserIdChange: (v: string) => void
  onSearch: () => void
  onReset: () => void
}

export function AuthDeptFilter({ userId, onUserIdChange, onSearch, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">用户ID</Label>
        <Input
          className="h-9 w-48"
          value={userId}
          onChange={(e) => onUserIdChange(e.target.value)}
          placeholder="搜索用户ID"
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
