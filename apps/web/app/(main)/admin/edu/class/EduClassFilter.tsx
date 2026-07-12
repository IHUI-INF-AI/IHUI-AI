'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Search, Plus } from 'lucide-react'
import { Button, Input } from '@ihui/ui'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  onCreate: () => void
}

export function EduClassFilter({ search, onSearchChange, onCreate }: Props) {
  const t = useTranslations('admin.edu.class')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/edu">
          <ChevronLeft className="h-4 w-4" />
          {t('backToEdu')}
        </Link>
      </Button>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
        />
      </div>
      <Button onClick={onCreate} size="sm" className="ml-auto">
        <Plus className="h-4 w-4" />
        {t('create')}
      </Button>
    </div>
  )
}
