'use client'

import { MessageSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function MessagesHeader() {
  const t = useTranslations('privateMessages')
  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <MessageSquare className="h-6 w-6 text-primary" />
        {t('title')}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
    </div>
  )
}
