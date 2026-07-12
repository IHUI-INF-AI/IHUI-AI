'use client'

import { Input } from '@ihui/ui'

interface Props {
  search: string
  setSearch: (v: string) => void
}

export function MenuFilter({ search, setSearch }: Props) {
  return (
    <Input
      placeholder="搜索菜单名称..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="max-w-sm"
    />
  )
}
