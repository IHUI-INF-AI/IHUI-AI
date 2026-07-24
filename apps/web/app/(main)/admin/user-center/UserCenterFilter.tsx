'use client'
import { Search } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui-react'

interface UserSearch {
  nickname: string
  parentId: string
}

interface Props {
  search: UserSearch
  onSearchChange: (patch: Partial<UserSearch>) => void
  onSearch: () => void
  onReset: () => void
}

export function UserCenterFilter({ search, onSearchChange, onSearch, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label className="text-xs">昵称</Label>
        <Input
          className="h-9 w-48"
          value={search.nickname}
          onChange={(e) => onSearchChange({ nickname: e.target.value })}
          placeholder="搜索昵称"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">父级ID</Label>
        <Input
          className="h-9 w-48"
          value={search.parentId}
          onChange={(e) => onSearchChange({ parentId: e.target.value })}
          placeholder="搜索父级ID"
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
