'use client'

import { Search } from 'lucide-react'
import { Input } from '@ihui/ui-react'
import { DatePicker } from '@/components/form/DatePicker'

interface Props {
  searchName: string
  setSearchName: (v: string) => void
  searchBegin: string
  setSearchBegin: (v: string) => void
}

export function ZhsActivityFilter({
  searchName,
  setSearchName,
  searchBegin,
  setSearchBegin,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="搜索活动名称"
          className="h-9 pl-8"
        />
      </div>
      <DatePicker
        value={searchBegin}
        onChange={(v) => setSearchBegin(v as string)}
        placeholder="开始时间"
      />
    </div>
  )
}
