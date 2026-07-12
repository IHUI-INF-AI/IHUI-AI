'use client'

import Link from 'next/link'
import { Plus, ChevronLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui'

interface Props {
  onCreate: () => void
}

export function LearnCategoryFilter({ onCreate }: Props) {
  const t = useTranslations('admin.learn')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/learn">
          <ChevronLeft className="h-4 w-4" />
          {t('backToLearn')}
        </Link>
      </Button>
      <Button onClick={onCreate} size="sm" className="ml-auto">
        <Plus className="h-4 w-4" />
        {t('create')}
      </Button>
    </div>
  )
}
