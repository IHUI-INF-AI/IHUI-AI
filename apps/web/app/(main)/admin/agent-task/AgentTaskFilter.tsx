'use client'

import { Search } from 'lucide-react'
import { Input } from '@ihui/ui'
import { DatePicker } from '@/components/form/DatePicker'

interface Props {
  searchTitle: string
  setSearchTitle: (v: string) => void
  searchCreator: string
  setSearchCreator: (v: string) => void
  searchClosing: string
  setSearchClosing: (v: string) => void
}

export function AgentTaskFilter({
  searchTitle,
  setSearchTitle,
  searchCreator,
  setSearchCreator,
  searchClosing,
  setSearchClosing,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTitle}
          onChange={(e) => setSearchTitle(e.target.value)}
          placeholder="搜索需求标题"
          className="h-9 pl-8"
        />
      </div>
      <Input
        value={searchCreator}
        onChange={(e) => setSearchCreator(e.target.value)}
        placeholder="发布者"
        className="h-9 w-32"
      />
      <DatePicker
        value={searchClosing}
        onChange={(v) => setSearchClosing(v as string)}
        placeholder="截止时间"
      />
    </div>
  )
}
