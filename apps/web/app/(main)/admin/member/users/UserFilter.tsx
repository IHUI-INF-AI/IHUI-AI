'use client'

import { Search } from 'lucide-react'
import {
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { selectClass } from './helpers'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  level: string
  onLevelChange: (v: string) => void
  status: string
  onStatusChange: (v: string) => void
}

export function UserFilter({ search, onSearchChange, level, onLevelChange, status, onStatusChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索昵称/手机号"
          className="h-9 pl-8"
        />
      </div>
      <Select value={level} onValueChange={onLevelChange}>
        <SelectTrigger className={selectClass} aria-label="等级">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部等级</SelectItem>
          <SelectItem value="0">普通</SelectItem>
          <SelectItem value="1">白银</SelectItem>
          <SelectItem value="2">黄金</SelectItem>
          <SelectItem value="3">钻石</SelectItem>
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className={selectClass} aria-label="状态">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部状态</SelectItem>
          <SelectItem value="1">正常</SelectItem>
          <SelectItem value="0">禁用</SelectItem>
          <SelectItem value="3">已注销</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
