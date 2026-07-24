'use client'

import { Search } from 'lucide-react'
import { Input } from '@ihui/ui-react'
import { DatePicker } from '@/components/form/DatePicker'

interface Props {
  searchBegin: string
  setSearchBegin: (v: string) => void
  searchEnd: string
  setSearchEnd: (v: string) => void
  searchCreator: string
  setSearchCreator: (v: string) => void
}

export function ProductIdentityFilter({
  searchBegin,
  setSearchBegin,
  searchEnd,
  setSearchEnd,
  searchCreator,
  setSearchCreator,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DatePicker
        value={searchBegin}
        onChange={(v) => setSearchBegin(v as string)}
        placeholder="开始时间"
      />
      <DatePicker
        value={searchEnd}
        onChange={(v) => setSearchEnd(v as string)}
        placeholder="结束时间"
      />
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchCreator}
          onChange={(e) => setSearchCreator(e.target.value)}
          placeholder="搜索创建者"
          className="h-9 pl-8"
        />
      </div>
    </div>
  )
}
