'use client'

import Link from 'next/link'
import { Search, ChevronLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input } from '@ihui/ui'

interface Props {
  search: string
  setSearch: (v: string) => void
}

export function RuleFilter({ search, setSearch }: Props) {
  const t = useTranslations('admin.point')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/point">
          <ChevronLeft className="h-4 w-4" />
          {t('backToChannels')}
        </Link>
      </Button>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
        />
      </div>
    </div>
  )
}
