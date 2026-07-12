'use client'

import { Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function MembersHeader() {
  const t = useTranslations('members')
  return (
    <header className="space-y-1">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
        <Users className="h-7 w-7 text-primary" />
        {t('title')}
      </h1>
      <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
    </header>
  )
}
