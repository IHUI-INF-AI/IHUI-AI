'use client'

import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui'

export default function NotFound() {
  const t = useTranslations('common')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 text-center">
      <div className="space-y-2">
        <h1 className="text-7xl font-bold tracking-tighter text-muted-foreground">404</h1>
        <p className="text-lg font-medium">{t('notFoundTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('notFoundDescription')}</p>
      </div>
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
    </div>
  )
}
