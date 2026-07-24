'use client'

import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'
import { NotFound } from '@/components/common'

export default function NotFoundPage() {
  const t = useTranslations('common')

  return (
    <NotFound
      title={t('notFoundTitle')}
      description={t('notFoundDescription')}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Button>
          <Button asChild>
            <Link href="/">
              <Home className="h-4 w-4" />
              {t('backHome')}
            </Link>
          </Button>
        </div>
      }
    />
  )
}
