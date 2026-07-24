'use client'

import { HelpCircle, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'

interface Props {
  onCreate: () => void
}

export function HelpFilter({ onCreate }: Props) {
  const t = useTranslations('admin.help')
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <HelpCircle className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <Button size="sm" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        {t('create')}
      </Button>
    </div>
  )
}
