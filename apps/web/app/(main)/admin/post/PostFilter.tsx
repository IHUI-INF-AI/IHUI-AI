'use client'

import { Search } from 'lucide-react'

import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { inputCls } from './helpers'
import type { PostSearch } from './types'

interface PostFilterProps {
  search: PostSearch
  onSearchChange: (s: PostSearch) => void
  onSearch: () => void
  onReset: () => void
}

export function PostFilter({ search, onSearchChange, onSearch, onReset }: PostFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">岗位编码</Label>
        <Input
          value={search.postCode}
          onChange={(e) => onSearchChange({ ...search, postCode: e.target.value })}
          placeholder="岗位编码"
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">岗位名称</Label>
        <Input
          value={search.postName}
          onChange={(e) => onSearchChange({ ...search, postName: e.target.value })}
          placeholder="岗位名称"
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">状态</Label>
        <Select
          value={search.status || 'all'}
          onValueChange={(v) => onSearchChange({ ...search, status: v === 'all' ? '' : v })}
        >
          <SelectTrigger className={inputCls}>
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="0">正常</SelectItem>
            <SelectItem value="1">停用</SelectItem>
          </SelectContent>
        </Select>
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
