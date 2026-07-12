'use client'

import Link from 'next/link'
import { Plus, ChevronLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui'

interface Props {
  onCreate: () => void
}

export function LiveCategoryFilter({ onCreate }: Props) {
  const t = useTranslations('admin.live')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/live">
          <ChevronLeft className="h-4 w-4" />
          {t('backToLive')}
        </Link>
      </Button>
      <Button onClick={onCreate} size="sm" className="ml-auto">
        <Plus className="h-4 w-4" />
        {t('create')}
      </Button>
    </div>
  )
}
