'use client'

import { Search } from 'lucide-react'
import { Input } from '@ihui/ui'

interface Props {
  search: string
  onSearchChange: (v: string) => void
}

export function AdvertiseFilter({ search, onSearchChange }: Props) {
  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="搜索标题"
        className="h-9 pl-8"
      />
    </div>
  )
}
