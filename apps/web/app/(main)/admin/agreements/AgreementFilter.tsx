'use client'

import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { Button } from '@ihui/ui-react'

interface Props {
  onCreate: () => void
}

export function AgreementFilter({ onCreate }: Props) {
  const t = useTranslations('admin.agreements')
  const tc = useTranslations('common')
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <Button size="sm" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        {tc('create')}
      </Button>
    </div>
  )
}
