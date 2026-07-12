'use client'

import { Search } from 'lucide-react'
import { Input } from '@ihui/ui'

interface Props {
  searchDeveloper: string
  setSearchDeveloper: (v: string) => void
  searchAgent: string
  setSearchAgent: (v: string) => void
}

export function DeveloperLinkFilter({
  searchDeveloper,
  setSearchDeveloper,
  searchAgent,
  setSearchAgent,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchDeveloper}
          onChange={(e) => setSearchDeveloper(e.target.value)}
          placeholder="搜索开发者ID"
          className="h-9 pl-8"
        />
      </div>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchAgent}
          onChange={(e) => setSearchAgent(e.target.value)}
          placeholder="搜索 AgentID"
          className="h-9 pl-8"
        />
      </div>
    </div>
  )
}
