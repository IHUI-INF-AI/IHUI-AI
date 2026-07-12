'use client'

import { Search } from 'lucide-react'
import { Input } from '@ihui/ui'

interface Props {
  searchName: string
  setSearchName: (v: string) => void
  searchField1: string
  setSearchField1: (v: string) => void
}

export function ZhsAgentFilter({
  searchName,
  setSearchName,
  searchField1,
  setSearchField1,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="搜索名称"
          className="h-9 pl-8"
        />
      </div>
      <Input
        value={searchField1}
        onChange={(e) => setSearchField1(e.target.value)}
        placeholder="field1"
        className="h-9 w-40"
      />
    </div>
  )
}
