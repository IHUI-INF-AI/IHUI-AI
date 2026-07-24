'use client'

import Link from 'next/link'
import { Plus, ChevronLeft } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'

interface Props {
  onCreate: () => void
}

export function LearnRemindFilter({ onCreate }: Props) {
  const t = useTranslations('admin.edu.learn.remind')
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/learn">
            <ChevronLeft className="h-4 w-4" />
            {t('backToLearn')}
          </Link>
        </Button>
        <Button onClick={onCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>
    </>
  )
}
