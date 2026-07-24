'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Plus } from 'lucide-react'
import { Button } from '@ihui/ui-react'

interface Props {
  onCreate: () => void
}

export function CertTemplateFilter({ onCreate }: Props) {
  const t = useTranslations('admin.eduCertTemplate')
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/edu/certificate">
          <ChevronLeft className="h-4 w-4" />
          {t('backToCertificate')}
        </Link>
      </Button>
      <Button onClick={onCreate} size="sm" className="ml-auto">
        <Plus className="h-4 w-4" />
        {t('createTemplate')}
      </Button>
    </div>
  )
}
