'use client'

import { MessageSquare, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@ihui/ui'

interface Props {
  searchQuery: string
  onSearchChange: (v: string) => void
}

export function MessagesHeader({ searchQuery, onSearchChange }: Props) {
  const t = useTranslations('privateMessages')
  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageSquare className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="pl-9"
        />
      </div>
    </div>
  )
}
