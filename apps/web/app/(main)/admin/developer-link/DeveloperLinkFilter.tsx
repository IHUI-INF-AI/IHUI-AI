'use client'

import { useTranslations } from 'next-intl'
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
  const t = useTranslations('admin.developerLink')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchDeveloper}
          onChange={(e) => setSearchDeveloper(e.target.value)}
          placeholder={t('searchDeveloperPlaceholder')}
          className="h-9 pl-8"
        />
      </div>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchAgent}
          onChange={(e) => setSearchAgent(e.target.value)}
          placeholder={t('searchAgentPlaceholder')}
          className="h-9 pl-8"
        />
      </div>
    </div>
  )
}
