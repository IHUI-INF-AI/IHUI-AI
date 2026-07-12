'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@ihui/ui'

interface Props {
  searchAgentId: string
  setSearchAgentId: (v: string) => void
  searchName: string
  setSearchName: (v: string) => void
}

export function AgentRuleFilter({
  searchAgentId,
  setSearchAgentId,
  searchName,
  setSearchName,
}: Props) {
  const t = useTranslations('admin.agentRule')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchAgentId}
          onChange={(e) => setSearchAgentId(e.target.value)}
          placeholder={t('searchAgentId')}
          className="h-9 pl-8"
        />
      </div>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder={t('searchRuleName')}
          className="h-9 pl-8"
        />
      </div>
    </div>
  )
}
