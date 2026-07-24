'use client'

import { Search, RotateCcw } from 'lucide-react'
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { selectClass } from './helpers'
import type { ProductSearch } from './types'

interface Props {
  search: ProductSearch
  setSearch: (s: ProductSearch) => void
  onReset: () => void
}

export function ProductFilter({ search, setSearch, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search.name}
          onChange={(e) => setSearch({ ...search, name: e.target.value })}
          placeholder="搜索商品名称"
          className="h-9 pl-8"
        />
      </div>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search.category}
          onChange={(e) => setSearch({ ...search, category: e.target.value })}
          placeholder="搜索分类"
          className="h-9 pl-8"
        />
      </div>
      <Input
        value={search.type}
        onChange={(e) => setSearch({ ...search, type: e.target.value })}
        placeholder="搜索类型"
        className="h-9 w-full max-w-[160px]"
      />
      <Select
        value={search.status}
        onValueChange={(v) => setSearch({ ...search, status: v === 'all' ? '' : v })}
      >
        <SelectTrigger className={cn(selectClass, 'w-[120px]')}>
          <SelectValue placeholder="状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部状态</SelectItem>
          <SelectItem value="online">上架</SelectItem>
          <SelectItem value="offline">下架</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={onReset}>
        <RotateCcw className="h-4 w-4" />
        重置
      </Button>
    </div>
  )
}
