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
} from '@ihui/ui'
import { inputCls } from './helpers'
import type { SearchState } from './types'

interface Props {
  search: SearchState
  onSearchChange: (patch: Partial<SearchState>) => void
  onQuery: () => void
  onReset: () => void
}

export function TaskLogFilter({ search, onSearchChange, onQuery, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">任务名称</Label>
        <Input
          value={search.jobName}
          onChange={(e) => onSearchChange({ jobName: e.target.value })}
          placeholder="任务名称"
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">任务组</Label>
        <Input
          value={search.jobGroup}
          onChange={(e) => onSearchChange({ jobGroup: e.target.value })}
          placeholder="任务组"
          className={inputCls}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">状态</Label>
        <Select
          value={search.status || 'all'}
          onValueChange={(v) => onSearchChange({ status: v === 'all' ? '' : v })}
        >
          <SelectTrigger className={inputCls}>
            <SelectValue placeholder="全部" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="0">成功</SelectItem>
            <SelectItem value="1">失败</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onQuery}>
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
