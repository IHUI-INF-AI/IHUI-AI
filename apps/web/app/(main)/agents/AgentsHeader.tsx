'use client'

import { Bot } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function AgentsHeader() {
  const t = useTranslations('agents')
  return (
    <header className="space-y-1">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
        <Bot className="h-7 w-7 text-primary" />
        {t('marketTitle')}
      </h1>
      <p className="text-sm text-muted-foreground">{t('marketSubtitle')}</p>
    </header>
  )
}
