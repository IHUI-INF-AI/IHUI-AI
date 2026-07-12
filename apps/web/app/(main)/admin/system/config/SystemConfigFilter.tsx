'use client'

import { Search } from 'lucide-react'
import { Input } from '@ihui/ui'
import { CATEGORIES, CATEGORY_LABEL, tabCls } from './helpers'
import type { Category } from './types'

interface Props {
  category: 'all' | Category
  onCategoryChange: (c: 'all' | Category) => void
  search: string
  onSearchChange: (v: string) => void
}

export function SystemConfigFilter({ category, onCategoryChange, search, onSearchChange }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        <button onClick={() => onCategoryChange('all')} className={tabCls(category === 'all')}>
          全部
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => onCategoryChange(c)} className={tabCls(category === c)}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索配置键"
          className="h-9 pl-8"
        />
      </div>
    </div>
  )
}
